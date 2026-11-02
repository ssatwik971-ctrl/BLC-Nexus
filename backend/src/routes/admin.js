import { Router } from 'express';
import { z } from 'zod';
import { HttpError, ah, parse, text, optionalText, publicUser } from '../utils/http.js';
import { applicationDecisionEmail, resetEmail } from '../utils/emails.js';
import { newToken, sha256 } from '../utils/security.js';
import { logAction } from '../utils/notify.js';
import { sendInvite } from './auth.js';

const SETTING_KEYS = ['home', 'about', 'stats', 'recruiting'];

/** Admin-only routes. Mounted at /api/admin behind authenticate + requireRole('ADMIN'). */
export default function adminRoutes(ctx) {
  const r = Router();
  const { prisma, config, mailer } = ctx;

  // ---------- Applications ----------
  r.get(
    '/applications',
    ah(async (req, res) => {
      const where = req.query.status ? { status: String(req.query.status).toUpperCase() } : {};
      const apps = await prisma.application.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
      res.json({ applications: apps.map(({ tokenHash, ...a }) => a) });
    }),
  );

  r.patch(
    '/applications/:id',
    ah(async (req, res) => {
      const { status, note } = parse(
        z.object({ status: z.enum(['APPROVED', 'REJECTED', 'WAITLISTED', 'PENDING']), note: optionalText(500) }),
        req.body,
      );
      const app = await prisma.application.findUnique({ where: { id: req.params.id } });
      if (!app) throw new HttpError(404, 'Application not found');
      if (app.status === 'APPROVED') throw new HttpError(409, 'This application was already approved');

      if (status === 'APPROVED') {
        const taken = await prisma.user.findFirst({
          where: { OR: [{ email: app.email }, { inGameName: app.inGameName }] },
        });
        if (taken) throw new HttpError(409, 'A member with this email or in-game name already exists');

        const user = await prisma.user.create({
          data: {
            email: app.email,
            inGameName: app.inGameName,
            playerId: app.playerId,
            role: 'MEMBER',
            status: 'INVITED',
          },
        });
        await sendInvite(ctx, user);
        await prisma.application.update({
          where: { id: app.id },
          data: { status, decisionNote: note, reviewedAt: new Date(), userId: user.id },
        });
        await logAction(ctx, req, 'application.approve', { applicationId: app.id, userId: user.id });
        return res.json({ ok: true, status, userId: user.id });
      }

      const updated = await prisma.application.update({
        where: { id: app.id },
        data: { status, decisionNote: note, reviewedAt: status === 'PENDING' ? null : new Date() },
      });
      if (status === 'REJECTED' || status === 'WAITLISTED') {
        await mailer.send({ to: app.email, ...applicationDecisionEmail(config, updated) });
      }
      await logAction(ctx, req, `application.${status.toLowerCase()}`, { applicationId: app.id });
      return res.json({ ok: true, status });
    }),
  );

  // ---------- Members ----------
  r.get(
    '/users',
    ah(async (_req, res) => {
      const users = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
      res.json({ users: users.map(publicUser) });
    }),
  );

  r.post(
    '/users',
    ah(async (req, res) => {
      const body = parse(
        z.object({
          email: z.string().email().max(254),
          inGameName: text(40, 2),
          playerId: optionalText(60),
          role: z.enum(['MEMBER', 'OFFICER', 'ADMIN']).default('MEMBER'),
        }),
        req.body,
      );
      const user = await prisma.user.create({
        data: { ...body, email: body.email.toLowerCase(), status: 'INVITED' },
      });
      await sendInvite(ctx, user);
      await logAction(ctx, req, 'user.invite', { userId: user.id, role: user.role });
      res.status(201).json({ user: publicUser(user) });
    }),
  );

  async function assertNotLastAdmin(target, willStopBeingAdmin) {
    if (target.role === 'ADMIN' && willStopBeingAdmin) {
      const admins = await prisma.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
      if (admins <= 1) throw new HttpError(400, 'BLC Nexus must keep at least one active admin');
    }
  }

  r.patch(
    '/users/:id',
    ah(async (req, res) => {
      const body = parse(
        z.object({
          role: z.enum(['MEMBER', 'OFFICER', 'ADMIN']).optional(),
          status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
          inGameName: text(40, 2).optional(),
        }),
        req.body,
      );
      const target = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!target) throw new HttpError(404, 'Member not found');
      if (target.id === req.user.id && (body.role || body.status === 'SUSPENDED')) {
        throw new HttpError(400, 'You cannot change your own role or suspend yourself');
      }
      await assertNotLastAdmin(target, (body.role && body.role !== 'ADMIN') || body.status === 'SUSPENDED');
      const user = await prisma.user.update({ where: { id: target.id }, data: body });
      await logAction(ctx, req, 'user.update', { userId: target.id, changes: body });
      res.json({ user: publicUser(user) });
    }),
  );

  r.delete(
    '/users/:id',
    ah(async (req, res) => {
      const target = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!target) throw new HttpError(404, 'Member not found');
      if (target.id === req.user.id) throw new HttpError(400, 'You cannot remove yourself');
      await assertNotLastAdmin(target, true);
      await prisma.user.delete({ where: { id: target.id } });
      await logAction(ctx, req, 'user.delete', { userId: target.id, inGameName: target.inGameName });
      res.json({ ok: true });
    }),
  );

  r.post(
    '/users/:id/reset-password',
    ah(async (req, res) => {
      const target = await prisma.user.findUnique({ where: { id: req.params.id } });
      if (!target) throw new HttpError(404, 'Member not found');
      if (ctx.identityMode) {
        // Identity recovery/invitations are sent from the Netlify Identity dashboard.
        await logAction(ctx, req, 'user.identity-email-required', { userId: target.id });
        return res.json({ ok: true, identityDashboardRequired: true });
      }
      if (target.status === 'INVITED') {
        await sendInvite(ctx, target);
      } else {
        const token = newToken();
        await prisma.user.update({
          where: { id: target.id },
          data: { resetTokenHash: sha256(token), resetExpires: new Date(Date.now() + 60 * 60 * 1000) },
        });
        await mailer.send({ to: target.email, ...resetEmail(config, target, token) });
      }
      await logAction(ctx, req, 'user.reset-password', { userId: target.id });
      res.json({ ok: true });
    }),
  );

  // ---------- Site settings ----------
  r.put(
    '/settings/:key',
    ah(async (req, res) => {
      if (!SETTING_KEYS.includes(req.params.key)) throw new HttpError(400, 'Unknown setting');
      const { value } = parse(z.object({ value: z.any() }), req.body);
      if (value === undefined) throw new HttpError(400, 'Value required');
      if (JSON.stringify(value).length > 20000) throw new HttpError(413, 'Setting is too large');
      const row = await prisma.siteSetting.upsert({
        where: { key: req.params.key },
        update: { value },
        create: { key: req.params.key, value },
      });
      await logAction(ctx, req, 'settings.update', { key: req.params.key });
      res.json({ setting: row });
    }),
  );

  // ---------- Public leaderboard (manual entry) ----------
  r.put(
    '/leaderboard/:kind',
    ah(async (req, res) => {
      const kind = String(req.params.kind).toUpperCase();
      if (!['ACTIVITY', 'DONATION'].includes(kind)) throw new HttpError(400, 'kind must be activity or donation');
      const { entries } = parse(
        z.object({ entries: z.array(z.object({ name: text(60, 1), score: z.coerce.number().min(0) })).max(100) }),
        req.body,
      );
      const sorted = [...entries].sort((a, b) => b.score - a.score);
      await prisma.$transaction([
        prisma.leaderboardEntry.deleteMany({ where: { kind } }),
        prisma.leaderboardEntry.createMany({
          data: sorted.map((e, i) => ({ kind, name: e.name, score: e.score, rank: i + 1 })),
        }),
      ]);
      await logAction(ctx, req, 'leaderboard.update', { kind, count: sorted.length });
      res.json({ ok: true, count: sorted.length });
    }),
  );

  // ---------- Action log ----------
  r.get(
    '/logs',
    ah(async (_req, res) => {
      const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 200 });
      res.json({ logs });
    }),
  );

  return r;
}
