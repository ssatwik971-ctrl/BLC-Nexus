import { Router } from 'express';
import { z } from 'zod';
import { HttpError, ah, parse, text, optionalText, atLeast } from '../utils/http.js';
import { mondayOf, parseDate } from '../utils/dates.js';
import { notify, logAction } from '../utils/notify.js';
import { maintenanceReminderEmail } from '../utils/emails.js';

const weekParam = (v) => mondayOf(parseDate(v) || new Date());

/** Offices, weekly maintenance, donation rewards and pledges. */
export default function opsRoutes(ctx, auth) {
  const r = Router();
  const { prisma, config, mailer } = ctx;
  const officer = auth.requireRole('OFFICER');
  const admin = auth.requireRole('ADMIN');

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
    admin,
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

  // ---------- Rewards ----------
  const rewardSchema = z.object({
    name: text(80, 1),
    description: optionalText(400),
    donationCost: z.coerce.number().min(0),
    currency: text(20, 1).default('coins'),
    type: text(40, 1).default('general'),
    status: z.enum(['AVAILABLE', 'PURCHASED', 'CLAIMED']).optional(),
  });

  r.get(
    '/rewards',
    ah(async (_req, res) => {
      const rewards = await prisma.rewardItem.findMany({
        orderBy: { name: 'asc' },
        include: { pledges: { where: { status: { in: ['PENDING', 'FULFILLED'] } }, select: { amount: true, status: true } } },
      });
      res.json({
        rewards: rewards.map(({ pledges, ...rw }) => ({
          ...rw,
          pledged: pledges.reduce((s, p) => s + p.amount, 0),
          fulfilled: pledges.filter((p) => p.status === 'FULFILLED').reduce((s, p) => s + p.amount, 0),
        })),
      });
    }),
  );

  r.post(
    '/rewards',
    officer,
    ah(async (req, res) => {
      const reward = await prisma.rewardItem.create({ data: parse(rewardSchema, req.body) });
      await logAction(ctx, req, 'reward.create', { id: reward.id });
      res.status(201).json({ reward });
    }),
  );

  r.patch(
    '/rewards/:id',
    officer,
    ah(async (req, res) => {
      const reward = await prisma.rewardItem.update({
        where: { id: req.params.id },
        data: parse(rewardSchema.partial(), req.body),
      });
      await logAction(ctx, req, 'reward.update', { id: reward.id });
      res.json({ reward });
    }),
  );

  r.delete(
    '/rewards/:id',
    admin,
    ah(async (req, res) => {
      await prisma.rewardItem.delete({ where: { id: req.params.id } });
      await logAction(ctx, req, 'reward.delete', { id: req.params.id });
      res.json({ ok: true });
    }),
  );

  // ---------- Pledges ----------
  r.get(
    '/pledges',
    ah(async (req, res) => {
      const mine = req.query.mine === '1';
      const pledges = await prisma.donationPledge.findMany({
        where: mine ? { userId: req.user.id } : {},
        include: { reward: { select: { id: true, name: true } }, user: { select: { id: true, inGameName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      res.json({ pledges });
    }),
  );

  r.get(
    '/pledges/leaderboard',
    ah(async (_req, res) => {
      const grouped = await prisma.donationPledge.groupBy({
        by: ['userId'],
        where: { status: 'FULFILLED' },
        _sum: { amount: true },
        orderBy: { _sum: { amount: 'desc' } },
        take: 20,
      });
      const users = await prisma.user.findMany({ where: { id: { in: grouped.map((g) => g.userId) } } });
      const names = new Map(users.map((u) => [u.id, u.inGameName]));
      res.json({
        leaderboard: grouped.map((g, i) => ({ rank: i + 1, userId: g.userId, name: names.get(g.userId), total: g._sum.amount })),
      });
    }),
  );

  r.post(
    '/pledges',
    ah(async (req, res) => {
      const body = parse(
        z.object({ rewardItemId: z.string().min(1), amount: z.coerce.number().positive(), note: optionalText(200) }),
        req.body,
      );
      const reward = await prisma.rewardItem.findUnique({ where: { id: body.rewardItemId } });
      if (!reward || reward.status !== 'AVAILABLE') throw new HttpError(400, 'That reward is not open for pledges');
      const pledge = await prisma.donationPledge.create({
        data: { ...body, userId: req.user.id, status: 'PENDING' },
      });
      res.status(201).json({ pledge });
    }),
  );

  r.patch(
    '/pledges/:id',
    ah(async (req, res) => {
      const { status } = parse(z.object({ status: z.enum(['PENDING', 'FULFILLED', 'CANCELLED']) }), req.body);
      const pledge = await prisma.donationPledge.findUnique({ where: { id: req.params.id } });
      if (!pledge) throw new HttpError(404, 'Pledge not found');
      const isOfficer = atLeast(req.user.role, 'OFFICER');
      if (!isOfficer && !(pledge.userId === req.user.id && status === 'CANCELLED' && pledge.status === 'PENDING')) {
        throw new HttpError(403, 'You can only cancel your own pending pledges');
      }
      const updated = await prisma.donationPledge.update({
        where: { id: pledge.id },
        data: { status, fulfilledAt: status === 'FULFILLED' ? new Date() : null },
      });
      if (isOfficer && status === 'FULFILLED') {
        await notify(ctx, pledge.userId, 'Your donation pledge was marked as received. Thank you!', '/app/donations');
      }
      res.json({ pledge: updated });
    }),
  );

  return r;
}
