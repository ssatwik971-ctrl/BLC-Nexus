import { Router } from 'express';
import { z } from 'zod';
import { HttpError, ah, parse, text, optionalText, atLeast } from '../utils/http.js';
import { mondayOf, parseDate } from '../utils/dates.js';
import { notify, logAction } from '../utils/notify.js';
import { maintenanceReminderEmail } from '../utils/emails.js';

const weekParam = (v) => mondayOf(parseDate(v) || new Date());

/** Offices, weekly maintenance and donations. */
export default function opsRoutes(ctx, auth) {
  const r = Router();
  const { prisma, config, mailer } = ctx;
  const officer = auth.requireRole('OFFICER');

  // ---------- Offices ----------
  const officeSchema = z.object({
    name: text(40, 1),
    description: optionalText(300),
    level: z.coerce.number().int().min(0).max(1000),
    weeklyMoneyCost: z.coerce.number().min(0),
    weeklyCoinCost: z.coerce.number().int().min(0),
    sortOrder: z.coerce.number().int().min(0).max(1000).optional(),
  });

  r.get(
    '/offices',
    ah(async (_req, res) => {
      res.json({ offices: await prisma.office.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }) });
    }),
  );

  r.post(
    '/offices',
    officer,
    ah(async (req, res) => {
      const data = parse(officeSchema, req.body);
      const office = await prisma.office.create({ data });
      await logAction(ctx, req, 'office.create', { id: office.id, name: office.name });
      res.status(201).json({ office });
    }),
  );

  r.patch(
    '/offices/:id',
    officer,
    ah(async (req, res) => {
      const data = parse(officeSchema.partial(), req.body);
      const office = await prisma.office.update({ where: { id: req.params.id }, data });
      await logAction(ctx, req, 'office.update', { id: office.id });
      res.json({ office });
    }),
  );

  r.delete(
    '/offices/:id',
    officer,
    ah(async (req, res) => {
      await prisma.office.delete({ where: { id: req.params.id } });
      await logAction(ctx, req, 'office.delete', { id: req.params.id });
      res.json({ ok: true });
    }),
  );

  // ---------- Maintenance ----------
  r.get(
    '/maintenance',
    ah(async (req, res) => {
      const week = weekParam(req.query.week);
      const assignments = await prisma.maintenanceAssignment.findMany({
        where: { weekStart: week },
        include: { office: true, user: { select: { id: true, inGameName: true } } },
        orderBy: { createdAt: 'asc' },
      });
      res.json({ week, assignments });
    }),
  );

  r.get(
    '/maintenance/history',
    ah(async (req, res) => {
      const mine = req.query.mine === '1';
      const assignments = await prisma.maintenanceAssignment.findMany({
        where: { weekStart: { lt: mondayOf() }, ...(mine ? { userId: req.user.id } : {}) },
        include: { office: true, user: { select: { id: true, inGameName: true } } },
        orderBy: { weekStart: 'desc' },
        take: 150,
      });
      res.json({ assignments });
    }),
  );

  r.post(
    '/maintenance',
    officer,
    ah(async (req, res) => {
      const body = parse(
        z.object({
          officeId: z.string().min(1),
          userId: z.string().min(1),
          weekStart: z.string().optional(),
          dueAt: z.string().optional().nullable(),
          note: optionalText(200),
        }),
        req.body,
      );
      const assignment = await prisma.maintenanceAssignment.create({
        data: {
          officeId: body.officeId,
          userId: body.userId,
          weekStart: weekParam(body.weekStart),
          dueAt: parseDate(body.dueAt),
          note: body.note,
          status: 'UNPAID',
        },
        include: { office: true },
      });
      await notify(ctx, assignment.userId, `You were assigned ${assignment.office.name} maintenance.`, '/app/maintenance');
      await logAction(ctx, req, 'maintenance.assign', { id: assignment.id });
      res.status(201).json({ assignment });
    }),
  );

  r.post(
    '/maintenance/copy-week',
    officer,
    ah(async (req, res) => {
      const { from, to } = parse(z.object({ from: z.string(), to: z.string() }), req.body);
      const fromWeek = weekParam(from);
      const toWeek = weekParam(to);
      const source = await prisma.maintenanceAssignment.findMany({ where: { weekStart: fromWeek } });
      if (!source.length) throw new HttpError(404, 'No assignments found in the source week');
      const result = await prisma.maintenanceAssignment.createMany({
        data: source.map((a) => ({ officeId: a.officeId, userId: a.userId, weekStart: toWeek, status: 'UNPAID' })),
        skipDuplicates: true,
      });
      await logAction(ctx, req, 'maintenance.copy-week', { from: fromWeek, to: toWeek, created: result.count });
      res.json({ created: result.count });
    }),
  );

  r.patch(
    '/maintenance/:id',
    ah(async (req, res) => {
      const { status, note } = parse(
        z.object({ status: z.enum(['UNPAID', 'PAID', 'LATE', 'WAIVED']).optional(), note: optionalText(200) }),
        req.body,
      );
      const existing = await prisma.maintenanceAssignment.findUnique({ where: { id: req.params.id } });
      if (!existing) throw new HttpError(404, 'Assignment not found');
      const isOfficer = atLeast(req.user.role, 'OFFICER');
      // Members may only mark their own assignment as paid; officers can verify/override.
      if (!isOfficer && (existing.userId !== req.user.id || (status && status !== 'PAID'))) {
        throw new HttpError(403, 'You can only mark your own maintenance as paid');
      }
      const assignment = await prisma.maintenanceAssignment.update({
        where: { id: existing.id },
        data: {
          ...(status ? { status, paidAt: status === 'PAID' ? new Date() : null } : {}),
          ...(isOfficer && note !== undefined ? { note } : {}),
        },
      });
      res.json({ assignment });
    }),
  );

  r.delete(
    '/maintenance/:id',
    officer,
    ah(async (req, res) => {
      await prisma.maintenanceAssignment.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    }),
  );

  r.post(
    '/maintenance/remind',
    officer,
    ah(async (req, res) => {
      const week = weekParam(req.body?.week);
      const unpaid = await prisma.maintenanceAssignment.findMany({
        where: { weekStart: week, status: { in: ['UNPAID', 'LATE'] } },
        include: { office: true, user: true },
      });
      const weekLabel = week.toISOString().slice(0, 10);
      for (const a of unpaid) {
        await notify(ctx, a.userId, `Reminder: ${a.office.name} maintenance is unpaid (week of ${weekLabel}).`, '/app/maintenance');
        if (a.user.notifyEmail) {
          await mailer.send({ to: a.user.email, ...maintenanceReminderEmail(config, a.user, a.office, weekLabel) });
        }
      }
      await logAction(ctx, req, 'maintenance.remind', { week: weekLabel, count: unpaid.length });
      res.json({ reminded: unpaid.length });
    }),
  );

  // ---------- Donations (cash and coins are tracked separately) ----------
  // The game has no pledge step: a member donates in-game and an officer records it here.
  const donationType = z.enum(['CASH', 'COINS']);
  const typeParam = (v) => {
    const t = String(v || '').toUpperCase();
    if (!['CASH', 'COINS'].includes(t)) throw new HttpError(400, 'type must be cash or coins');
    return t;
  };

  r.get(
    '/donations',
    ah(async (req, res) => {
      const type = typeParam(req.query.type);
      const [donations, all] = await Promise.all([
        prisma.donation.findMany({
          where: { type },
          include: { user: { select: { id: true, inGameName: true } } },
          orderBy: { donatedAt: 'desc' },
          take: 200,
        }),
        prisma.donation.findMany({ where: { type }, select: { userId: true, amount: true } }),
      ]);
      res.json({
        type,
        donations,
        total: all.reduce((sum, d) => sum + d.amount, 0),
        mine: all.filter((d) => d.userId === req.user.id).reduce((sum, d) => sum + d.amount, 0),
        count: all.length,
      });
    }),
  );

  r.get(
    '/donations/leaderboard',
    ah(async (req, res) => {
      const type = typeParam(req.query.type);
      const grouped = await prisma.donation.groupBy({
        by: ['userId'],
        where: { type },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 20,
      });
      const users = await prisma.user.findMany({ where: { id: { in: grouped.map((g) => g.userId) } } });
      const names = new Map(users.map((u) => [u.id, u.inGameName]));
      res.json({
        type,
        leaderboard: grouped.map((g, i) => ({ rank: i + 1, userId: g.userId, name: names.get(g.userId), total: g._sum.amount })),
      });
    }),
  );

  r.post(
    '/donations',
    officer,
    ah(async (req, res) => {
      const body = parse(
        z.object({
          userId: z.string().min(1),
          type: donationType,
          amount: z.coerce.number().positive().max(1e15),
          note: optionalText(200),
          donatedAt: z.string().optional().nullable(),
        }),
        req.body,
      );
      if (body.type === 'COINS' && !Number.isInteger(body.amount)) throw new HttpError(400, 'Coin donations must be whole numbers');
      const member = await prisma.user.findUnique({ where: { id: body.userId } });
      if (!member || member.status !== 'ACTIVE') throw new HttpError(404, 'Member not found');
      const donation = await prisma.donation.create({
        data: {
          userId: member.id,
          type: body.type,
          amount: body.amount,
          note: body.note,
          donatedAt: parseDate(body.donatedAt) || new Date(),
          recordedById: req.user.id,
        },
      });
      const label = body.type === 'CASH' ? 'cash' : 'coins';
      await notify(ctx, member.id, `Your ${label} donation of ${body.amount.toLocaleString('en-US')} was recorded. Thank you!`, '/app/donations');
      await logAction(ctx, req, 'donation.record', { id: donation.id, userId: member.id, type: body.type, amount: body.amount });
      res.status(201).json({ donation });
    }),
  );

  r.delete(
    '/donations/:id',
    officer,
    ah(async (req, res) => {
      await prisma.donation.delete({ where: { id: req.params.id } });
      await logAction(ctx, req, 'donation.delete', { id: req.params.id });
      res.json({ ok: true });
    }),
  );

  return r;
}
