import { Router } from 'express';
import { z } from 'zod';
import { HttpError, ah, parse, text, optionalText } from '../utils/http.js';
import { mondayOf, parseDate, DAY } from '../utils/dates.js';
import { notify, logAction } from '../utils/notify.js';
import { currentPower, withCosts, officeRule } from '../utils/maintenanceCost.js';

const weekParam = (v) => mondayOf(parseDate(v) || new Date());

/** Offices, weekly maintenance totals, donations and weekly donation status. */
export default function opsRoutes(ctx, auth) {
  const r = Router();
  const { prisma } = ctx;
  const officer = auth.requireRole('OFFICER');
  const adminOnly = auth.requireRole('ADMIN');

  // ---------- Offices ----------
  const officeSchema = z.object({
    name: text(40, 1),
    description: optionalText(300),
    level: z.coerce.number().int().min(0).max(1000),
    weeklyMoneyCost: z.coerce.number().min(0).optional().default(0),
    weeklyCoinCost: z.coerce.number().int().min(0).optional().default(0),
    sortOrder: z.coerce.number().int().min(0).max(1000).optional(),
  });

  /** A level above the office's maximum is a typo, so refuse it. */
  const checkLevel = (name, level) => {
    const rule = officeRule(name);
    if (rule && level > rule.maxLevel) throw new HttpError(400, `${name} has a maximum level of ${rule.maxLevel}.`);
  };

  r.get(
    '/offices',
    ah(async (_req, res) => {
      // The cash cost is recalculated from the coop's latest power every time, so it follows power changes.
      const [rows, { power, date }] = await Promise.all([
        prisma.office.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
        currentPower(prisma),
      ]);
      const offices = withCosts(rows, power);
      res.json({
        offices,
        power,
        powerDate: date,
        totalWeeklyMoneyCost: offices.reduce((sum, o) => sum + o.weeklyMoneyCost, 0),
      });
    }),
  );

  r.post(
    '/offices',
    adminOnly,
    ah(async (req, res) => {
      const data = parse(officeSchema, req.body);
      checkLevel(data.name, data.level);
      const office = await prisma.office.create({ data });
      await logAction(ctx, req, 'office.create', { id: office.id, name: office.name });
      res.status(201).json({ office });
    }),
  );

  r.patch(
    '/offices/:id',
    adminOnly,
    ah(async (req, res) => {
      const data = parse(officeSchema.partial(), req.body);
      if (data.level !== undefined) {
        const current = data.name ? null : await prisma.office.findUnique({ where: { id: req.params.id } });
        checkLevel(data.name || current?.name, data.level);
      }
      const office = await prisma.office.update({ where: { id: req.params.id }, data });
      await logAction(ctx, req, 'office.update', { id: office.id });
      res.json({ office });
    }),
  );

  r.delete(
    '/offices/:id',
    adminOnly,
    ah(async (req, res) => {
      await prisma.office.delete({ where: { id: req.params.id } });
      await logAction(ctx, req, 'office.delete', { id: req.params.id });
      res.json({ ok: true });
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
  const money = (n) => Math.round(n * 100) / 100; // avoid floating-point dust such as 0.30000000000000004
  const sumExpenses = (rows) => ({
    cash: money(rows.reduce((s, e) => s + (e.cash || 0), 0)),
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
      const total = money(all.reduce((sum, d) => sum + d.amount, 0));
      const spent = money(expenses.reduce((sum, e) => sum + (type === 'CASH' ? e.cash || 0 : e.coins || 0), 0));
      res.json({
        type,
        donations,
        total,
        spent,
        balance: money(total - spent), // coop total balance = donated - maintenance paid
        mine: money(all.filter((d) => d.userId === req.user.id).reduce((sum, d) => sum + d.amount, 0)),
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
      // Officers cannot mark themselves; the admin (or another officer) does it.
      if (body.userId === req.user.id && req.user.role !== 'ADMIN') {
        throw new HttpError(403, 'You cannot change your own donation status');
      }
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
