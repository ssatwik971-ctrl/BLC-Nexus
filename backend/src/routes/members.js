import { Router } from 'express';
import { z } from 'zod';
import { HttpError, ah, parse, text, optionalText, publicUser, atLeast } from '../utils/http.js';
import { mondayOf, DAY } from '../utils/dates.js';
import { readSettings } from './public.js';

const HIDEABLE = ['playerId', 'timezone', 'contact', 'avatarUrl'];

const validTimezone = (tz) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export default function memberRoutes(ctx) {
  const r = Router();
  const { prisma } = ctx;

  // ---------- Dashboard ----------
  r.get(
    '/dashboard',
    ah(async (req, res) => {
      const now = new Date();
      const week = mondayOf(now);
      const nextDue = new Date(week.getTime() + 7 * DAY);

      const [settings, offices, myStatus, votes, unread] = await Promise.all([
        readSettings(prisma),
        prisma.office.findMany({ orderBy: { sortOrder: 'asc' } }),
        prisma.weeklyDonationStatus.findFirst({ where: { userId: req.user.id, weekStart: week } }),
        prisma.vote.findMany({ where: { status: 'OPEN', endTime: { gt: now } } }),
        prisma.notification.count({ where: { userId: req.user.id, read: false } }),
      ]);

      const myVotes = await prisma.voteRecord.findMany({
        where: { userId: req.user.id, voteId: { in: votes.map((v) => v.id) } },
      });
      const voted = new Set(myVotes.map((v) => v.voteId));
      const pendingVotes = votes.filter((v) => atLeast(req.user.role, v.eligibleRole) && !voted.has(v.id));

      res.json({
        stats: settings.stats,
        offices: {
          count: offices.length,
          totalWeeklyMoneyCost: offices.reduce((s, o) => s + o.weeklyMoneyCost, 0),
          totalWeeklyCoinCost: offices.reduce((s, o) => s + o.weeklyCoinCost, 0),
          list: offices,
        },
        nextMaintenanceDue: nextDue,
        currentWeek: week,
        myDonationMet: Boolean(myStatus?.met),
        pendingVotes,
        unreadNotifications: unread,
      });
    }),
  );

  // ---------- Roster ----------
  r.get(
    '/users',
    ah(async (req, res) => {
      const q = String(req.query.q || '').trim();
      const users = await prisma.user.findMany({
        where: {
          status: 'ACTIVE',
          ...(q ? { inGameName: { contains: q, mode: 'insensitive' } } : {}),
        },
        orderBy: { inGameName: 'asc' },
      });
      const isAdmin = req.user.role === 'ADMIN';
      res.json({
        members: users.map((u) => {
          const hidden = u.id === req.user.id || isAdmin ? [] : u.hiddenFields || [];
          const base = {
            id: u.id,
            inGameName: u.inGameName,
            role: u.role,
            joinedAt: u.joinedAt,
            playerId: u.playerId,
            timezone: u.timezone,
            contact: u.contact,
            avatarUrl: u.avatarUrl,
          };
          for (const f of hidden) base[f] = null;
          return base;
        }),
      });
    }),
  );

  // ---------- Own profile ----------
  r.get(
    '/users/me',
    ah(async (req, res) => {
      const [recent, totals, weeksMet, posts] = await Promise.all([
        prisma.donation.findMany({
          where: { userId: req.user.id },
          orderBy: { donatedAt: 'desc' },
          take: 50,
        }),
        prisma.donation.groupBy({ by: ['type'], where: { userId: req.user.id }, _sum: { amount: true } }),
        prisma.weeklyDonationStatus.count({ where: { userId: req.user.id, met: true } }),
        prisma.forumPost.count({ where: { userId: req.user.id } }),
      ]);
      const sumOf = (type) => totals.find((t) => t.type === type)?._sum.amount || 0;
      res.json({
        user: publicUser(req.user),
        contributions: {
          donations: recent,
          totalCash: sumOf('CASH'),
          totalCoins: sumOf('COINS'),
          weeksDonated: weeksMet,
          forumPosts: posts,
        },
      });
    }),
  );

  r.patch(
    '/users/me',
    ah(async (req, res) => {
      const body = parse(
        z.object({
          inGameName: text(40, 2).optional(),
          avatarUrl: z
            .string()
            .max(500)
            .refine((v) => v === '' || /^https:\/\//i.test(v), 'Avatar must be an https:// URL')
            .optional(),
          timezone: z.string().max(60).refine(validTimezone, 'Unknown timezone').optional(),
          contact: optionalText(120),
          hiddenFields: z.array(z.enum(HIDEABLE)).optional(),
          notifyEmail: z.boolean().optional(),
        }),
        req.body,
      );
      if (body.avatarUrl === '') body.avatarUrl = null;
      const user = await prisma.user.update({ where: { id: req.user.id }, data: body });
      res.json({ user: publicUser(user) });
    }),
  );

  // ---------- Notifications ----------
  r.get(
    '/notifications',
    ah(async (req, res) => {
      const notifications = await prisma.notification.findMany({
        where: { userId: req.user.id },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
      res.json({ notifications });
    }),
  );

  r.post(
    '/notifications/read-all',
    ah(async (req, res) => {
      await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } });
      res.json({ ok: true });
    }),
  );

  r.post(
    '/notifications/:id/read',
    ah(async (req, res) => {
      const n = await prisma.notification.findUnique({ where: { id: req.params.id } });
      if (!n || n.userId !== req.user.id) throw new HttpError(404, 'Notification not found');
      await prisma.notification.update({ where: { id: n.id }, data: { read: true } });
      res.json({ ok: true });
    }),
  );

  return r;
}
