import { Router } from 'express';
import { z } from 'zod';
import { HttpError, ah, parse, text, optionalText, atLeast } from '../utils/http.js';
import { mondayOf, parseDate, DAY } from '../utils/dates.js';
import { notify, logAction } from '../utils/notify.js';
import { maintenanceReminderEmail } from '../utils/emails.js';

const weekParam = (v) => mondayOf(parseDate(v) || new Date());

/** Offices, weekly maintenance and donations. */
export default function opsRoutes(ctx, auth) {
  const r = Router();
  const { prisma, config, mailer } = ctx;
  const officer = auth.requireRole('OFFICER');
  const adminOnly = auth.requireRole('ADMIN');

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

  // ---------- Weekly maintenance totals (admin only) ----------
  // Maintenance is not assigned per member. At the end of each week the admin enters the
  // total cash and coins the cooperative paid; that amount comes off the coop's total balance.
  const iso = (d) => d.toISOString().slice(0, 10);
  const pastOrCurrentWeek = (v) => {
    const week = weekParam(v);
    if (week > mondayOf()) throw new HttpError(400, 'You cannot enter maintenance for a future week');
    return week;
  };
  const sumExpenses = (rows) => ({
    cash: rows.reduce((s, e) => s + (e.cash || 0), 0),
    coins: rows.reduce((s, e) => s + (e.coins || 0), 0),
  });

  /** The week the admin should be asked about: this week once it is Sunday, otherwise last week. */
  const duePromptWeek = (expenses, now = new Date()) => {
    const recorded = new Set(expenses.map((e) => iso(new Date(e.weekStart))));
    const thisWeek = mondayOf(now);
    const lastWeek = new Date(thisWeek.getTime() - 7 * DAY);
    if (now.getUTCDay() === 0 && !recorded.has(iso(thisWeek))) return iso(thisWeek);
    if (!recorded.has(iso(lastWeek))) return iso(lastWeek);
    return null;
  };

  r.get(
    '/maintenance-expenses',
    ah(async (req, res) => {
      const expenses = await prisma.maintenanceExpense.findMany({ orderBy: { weekStart: 'desc' }, take: 60 });
      const totals = sumExpenses(await prisma.maintenanceExpense.findMany({}));
      res.json({
        expenses,
        totals,
        // Only the admin is asked to enter totals.
        promptWeek: req.user.role === 'ADMIN' ? duePromptWeek(expenses) : null,
      });
    }),
  );

  r.put(
    '/maintenance-expenses',
    adminOnly,
    ah(async (req, res) => {
      const body = parse(
        z.object({
          weekStart: z.string().optional(),
          cash: z.coerce.number().min(0).max(1e15),
          coins: z.coerce.number().int().min(0).max(1e12),
          note: optionalText(200),
        }),
        req.body,
      );
      const week = pastOrCurrentWeek(body.weekStart);
      const existing = await prisma.maintenanceExpense.findUnique({ where: { weekStart: week } });
      const data = { cash: body.cash, coins: body.coins, note: body.note, enteredById: req.user.id };
      const expense = existing
        ? await prisma.maintenanceExpense.update({ where: { id: existing.id }, data })
        : await prisma.maintenanceExpense.create({ data: { weekStart: week, ...data } });
      await logAction(ctx, req, 'maintenance.total', { week: iso(week), cash: body.cash, coins: body.coins });
      res.json({ expense });
    }),
  );

  r.delete(
    '/maintenance-expenses/:id',
    adminOnly,
    ah(async (req, res) => {
      await prisma.maintenanceExpense.delete({ where: { id: req.params.id } });
      await logAction(ctx, req, 'maintenance.total.delete', { id: req.params.id });
      res.json({ ok: true });
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
      const [donations, all, expenses] = await Promise.all([
        prisma.donation.findMany({
          where: { type },
          include: { user: { select: { id: true, inGameName: true } } },
          orderBy: { donatedAt: 'desc' },
          take: 200,
        }),
        prisma.donation.findMany({ where: { type }, select: { userId: true, amount: true } }),
        prisma.maintenanceExpense.findMany({}),
      ]);
      const total = all.reduce((sum, d) => sum + d.amount, 0);
      const spent = expenses.reduce((sum, e) => sum + (type === 'CASH' ? e.cash || 0 : e.coins || 0), 0);
      res.json({
        type,
        donations,
        total,
        spent,
        balance: total - spent, // coop total balance = donated - maintenance paid
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

  // ---------- Weekly minimum-donation status (everyone can see; officers and admin set it) ----------
  r.get(
    '/donation-status',
    ah(async (req, res) => {
      const week = weekParam(req.query.week);
      const [users, statuses] = await Promise.all([
        prisma.user.findMany({ where: { status: 'ACTIVE' }, orderBy: { inGameName: 'asc' } }),
        prisma.weeklyDonationStatus.findMany({ where: { weekStart: week } }),
      ]);
      const byUser = new Map(statuses.map((x) => [x.userId, x]));
      const rank = { ADMIN: 0, OFFICER: 1, MEMBER: 2 };
      const people = users
        .map((u) => ({
          id: u.id,
          inGameName: u.inGameName,
          role: u.role,
          met: Boolean(byUser.get(u.id)?.met),
          updatedAt: byUser.get(u.id)?.updatedAt || null,
        }))
        .sort((a, b) => rank[a.role] - rank[b.role] || a.inGameName.localeCompare(b.inGameName));
      res.json({ week, people, metCount: people.filter((p) => p.met).length });
    }),
  );

  r.put(
    '/donation-status',
    officer,
    ah(async (req, res) => {
      const body = parse(
        z.object({ userId: z.string().min(1), met: z.boolean(), weekStart: z.string().optional() }),
        req.body,
      );
      const week = pastOrCurrentWeek(body.weekStart);
      const member = await prisma.user.findUnique({ where: { id: body.userId } });
      if (!member || member.status !== 'ACTIVE') throw new HttpError(404, 'Member not found');
      const existing = await prisma.weeklyDonationStatus.findFirst({ where: { userId: member.id, weekStart: week } });
      const data = { met: body.met, updatedById: req.user.id };
      const status = existing
        ? await prisma.weeklyDonationStatus.update({ where: { id: existing.id }, data })
        : await prisma.weeklyDonationStatus.create({ data: { userId: member.id, weekStart: week, ...data } });
      await logAction(ctx, req, 'donation-status.set', { userId: member.id, week: iso(week), met: body.met });
      res.json({ status });
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
