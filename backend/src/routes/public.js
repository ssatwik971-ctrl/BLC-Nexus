import { Router } from 'express';
import { z } from 'zod';
import { HttpError, ah, parse, text, optionalText } from '../utils/http.js';
import { newToken, sha256 } from '../utils/security.js';
import { applicationReceivedEmail, contactEmail } from '../utils/emails.js';

export const DEFAULT_SETTINGS = {
  home: {
    headline: 'The Command Center of the Billionaires Club',
    intro:
      'BILLIONAIRES CLUB (BLC) is a Ticarium: Business Tycoon cooperative built for players who want to grow faster together — shared offices, shared strategy, shared wins.',
  },
  about: {
    mission:
      'Coordinate, compete and climb. BLC members pool resources, keep every cooperative office maintained and share the strategies that move the leaderboard.',
    rules: [
      'Be active: check in at least a few times per week.',
      'Pay your assigned office maintenance before the weekly deadline.',
      'Respect every member — no harassment or drama.',
      'Share strategy openly; do not leak private BLC info.',
      'Officers have the final say on day-to-day operations; big decisions go to a vote.',
    ],
    benefits: [
      'Cash and coin donations tracked openly for the whole club',
      'A shared strategy wiki and active forums',
      'Transparent governance: member votes on major changes',
    ],
  },
  stats: { power: 0, rank: null, officeLevels: '', note: 'Update these from Admin → Site.' },
  recruiting: true,
};

export async function readSettings(prisma) {
  const rows = await prisma.siteSetting.findMany();
  const merged = { ...DEFAULT_SETTINGS };
  for (const row of rows) merged[row.key] = row.value;
  return merged;
}

export default function publicRoutes(ctx, limiters) {
  const r = Router();
  const { prisma, config, mailer } = ctx;

  r.get(
    '/public/site',
    ah(async (_req, res) => {
      const [settings, memberCount] = await Promise.all([
        readSettings(prisma),
        prisma.user.count({ where: { status: 'ACTIVE' } }),
      ]);
      res.json({ siteName: config.siteName, tagline: config.tagline, settings, memberCount });
    }),
  );

  r.get(
    '/public/leaderboard',
    ah(async (_req, res) => {
      const rows = await prisma.leaderboardEntry.findMany({ orderBy: [{ kind: 'asc' }, { rank: 'asc' }] });
      res.json({
        activity: rows.filter((e) => e.kind === 'ACTIVITY'),
        donation: rows.filter((e) => e.kind === 'DONATION'),
      });
    }),
  );

  r.post(
    '/public/contact',
    limiters.contact,
    ah(async (req, res) => {
      const body = parse(
        z.object({ name: text(80, 1), email: z.string().email().max(254), message: text(4000, 10) }),
        req.body,
      );
      if (config.contactEmail) await mailer.send({ to: config.contactEmail, ...contactEmail(config, body) });
      else ctx.logger.info(`[contact] ${body.name} <${body.email}>: ${body.message}`);
      res.json({ ok: true });
    }),
  );

  r.post(
    '/applications',
    limiters.apply,
    ah(async (req, res) => {
      const settings = await readSettings(prisma);
      if (settings.recruiting === false) throw new HttpError(403, 'BLC is not recruiting right now');

      const body = parse(
        z.object({
          inGameName: text(40, 2),
          playerId: text(60, 1),
          email: z.string().email().max(254),
          level: z.coerce.number().int().min(1).max(10000).optional(),
          power: optionalText(40),
          weeklyActivity: optionalText(200),
          reason: text(2000, 20),
          references: optionalText(500),
        }),
        req.body,
      );
      const email = body.email.toLowerCase();

      const existing = await prisma.application.findFirst({
        where: { status: { in: ['PENDING', 'WAITLISTED'] }, OR: [{ email }, { playerId: body.playerId }] },
      });
      if (existing) throw new HttpError(409, 'An application for this email or player ID is already in review');

      const token = newToken();
      const application = await prisma.application.create({
        data: {
          email,
          inGameName: body.inGameName,
          playerId: body.playerId,
          level: body.level ?? null,
          power: body.power,
          weeklyActivity: body.weeklyActivity,
          reason: body.reason,
          references: body.references,
          status: 'PENDING',
          tokenHash: sha256(token),
        },
      });
      await mailer.send({ to: email, ...applicationReceivedEmail(config, application, token) });
      res.status(201).json({
        id: application.id,
        token,
        statusUrl: `${config.frontendUrl}/apply/status/${token}`,
      });
    }),
  );

  r.get(
    '/applications/status/:token',
    ah(async (req, res) => {
      const app = await prisma.application.findUnique({ where: { tokenHash: sha256(req.params.token) } });
      if (!app) throw new HttpError(404, 'Application not found');
      res.json({
        inGameName: app.inGameName,
        status: app.status,
        submittedAt: app.createdAt,
        reviewedAt: app.reviewedAt,
        note: app.decisionNote,
      });
    }),
  );

  return r;
}
