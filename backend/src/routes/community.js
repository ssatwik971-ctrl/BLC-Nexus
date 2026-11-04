import { Router } from 'express';
import { z } from 'zod';
import { HttpError, ah, parse, text, optionalText, atLeast } from '../utils/http.js';
import { parseDate } from '../utils/dates.js';
import { notify, discordNotify, logAction } from '../utils/notify.js';

/** Forums, wiki and voting. */
export default function communityRoutes(ctx, auth, limiters) {
  const r = Router();
  const { prisma } = ctx;
  const officer = auth.requireRole('OFFICER');

  // ================= Forum =================
  r.get(
    '/forum/categories',
    ah(async (_req, res) => {
      const categories = await prisma.forumCategory.findMany({
        orderBy: { order: 'asc' },
        include: { _count: { select: { threads: true } } },
      });
      res.json({ categories });
    }),
  );

  const categorySchema = z.object({
    name: text(60, 1),
    description: optionalText(200),
    order: z.coerce.number().int().min(0).max(1000).default(0),
  });

  r.post(
    '/forum/categories',
    officer,
    ah(async (req, res) => {
      const category = await prisma.forumCategory.create({ data: parse(categorySchema, req.body) });
      res.status(201).json({ category });
    }),
  );

  r.patch(
    '/forum/categories/:id',
    officer,
    ah(async (req, res) => {
      const category = await prisma.forumCategory.update({
        where: { id: req.params.id },
        data: parse(categorySchema.partial(), req.body),
      });
      res.json({ category });
    }),
  );

  r.delete(
    '/forum/categories/:id',
    officer,
    ah(async (req, res) => {
      await prisma.forumCategory.delete({ where: { id: req.params.id } });
      await logAction(ctx, req, 'forum.category.delete', { id: req.params.id });
      res.json({ ok: true });
    }),
  );

  r.get(
    '/forum/categories/:id/threads',
    ah(async (req, res) => {
      const category = await prisma.forumCategory.findUnique({ where: { id: req.params.id } });
      if (!category) throw new HttpError(404, 'Category not found');
      const threads = await prisma.forumThread.findMany({
        where: { categoryId: category.id },
        orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
        include: { user: { select: { id: true, inGameName: true } }, _count: { select: { posts: true } } },
        take: 100,
      });
      res.json({ category, threads });
    }),
  );

  r.post(
    '/forum/threads',
    limiters.post,
    ah(async (req, res) => {
      const body = parse(
        z.object({ categoryId: z.string().min(1), title: text(150, 3), content: text(8000, 1) }),
        req.body,
      );
      const thread = await prisma.forumThread.create({
        data: {
          categoryId: body.categoryId,
          userId: req.user.id,
          title: body.title,
          posts: { create: { userId: req.user.id, content: body.content } },
        },
      });
      res.status(201).json({ thread });
    }),
  );

  r.get(
    '/forum/threads/:id',
    ah(async (req, res) => {
      const thread = await prisma.forumThread.findUnique({
        where: { id: req.params.id },
        include: {
          category: true,
          user: { select: { id: true, inGameName: true } },
          posts: {
            orderBy: { createdAt: 'asc' },
            include: { user: { select: { id: true, inGameName: true, role: true } }, upvotes: { select: { userId: true } } },
          },
        },
      });
      if (!thread) throw new HttpError(404, 'Thread not found');
      res.json({
        thread: {
          ...thread,
          posts: thread.posts.map(({ upvotes, ...p }) => ({
            ...p,
            upvoteCount: upvotes.length,
            upvoted: upvotes.some((u) => u.userId === req.user.id),
          })),
        },
      });
    }),
  );

  r.patch(
    '/forum/threads/:id',
    officer,
    ah(async (req, res) => {
      const body = parse(
        z.object({ pinned: z.boolean().optional(), locked: z.boolean().optional(), title: text(150, 3).optional() }),
        req.body,
      );
      const thread = await prisma.forumThread.update({ where: { id: req.params.id }, data: body });
      await logAction(ctx, req, 'forum.thread.moderate', { id: thread.id, ...body });
      res.json({ thread });
    }),
  );

  r.delete(
    '/forum/threads/:id',
    ah(async (req, res) => {
      const thread = await prisma.forumThread.findUnique({ where: { id: req.params.id } });
      if (!thread) throw new HttpError(404, 'Thread not found');
      if (thread.userId !== req.user.id && !atLeast(req.user.role, 'OFFICER')) throw new HttpError(403, 'Not allowed');
      await prisma.forumThread.delete({ where: { id: thread.id } });
      res.json({ ok: true });
    }),
  );

  r.post(
    '/forum/threads/:id/posts',
    limiters.post,
    ah(async (req, res) => {
      const { content } = parse(z.object({ content: text(8000, 1) }), req.body);
      const thread = await prisma.forumThread.findUnique({ where: { id: req.params.id } });
      if (!thread) throw new HttpError(404, 'Thread not found');
      if (thread.locked && !atLeast(req.user.role, 'OFFICER')) throw new HttpError(403, 'This thread is locked');
      const post = await prisma.forumPost.create({ data: { threadId: thread.id, userId: req.user.id, content } });
      await prisma.forumThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });
      if (thread.userId !== req.user.id) {
        await notify(ctx, thread.userId, `${req.user.inGameName} replied to "${thread.title}"`, `/app/forums/thread/${thread.id}`);
      }
      res.status(201).json({ post });
    }),
  );

  r.delete(
    '/forum/posts/:id',
    ah(async (req, res) => {
      const post = await prisma.forumPost.findUnique({ where: { id: req.params.id } });
      if (!post) throw new HttpError(404, 'Post not found');
      if (post.userId !== req.user.id && !atLeast(req.user.role, 'OFFICER')) throw new HttpError(403, 'Not allowed');
      await prisma.forumPost.delete({ where: { id: post.id } });
      res.json({ ok: true });
    }),
  );

  r.post(
    '/forum/posts/:id/upvote',
    ah(async (req, res) => {
      const key = { postId_userId: { postId: req.params.id, userId: req.user.id } };
      const existing = await prisma.postUpvote.findUnique({ where: key });
      if (existing) await prisma.postUpvote.delete({ where: key });
      else await prisma.postUpvote.create({ data: { postId: req.params.id, userId: req.user.id } });
      const count = await prisma.postUpvote.count({ where: { postId: req.params.id } });
      res.json({ upvoted: !existing, count });
    }),
  );

  // ================= Wiki =================
  const slugify = (s) =>
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);

  r.get(
    '/wiki',
    ah(async (_req, res) => {
      const pages = await prisma.wikiPage.findMany({
        orderBy: { title: 'asc' },
        select: { id: true, slug: true, title: true, updatedAt: true },
      });
      res.json({ pages });
    }),
  );

  r.get(
    '/wiki/:slug',
    ah(async (req, res) => {
      const page = await prisma.wikiPage.findUnique({ where: { slug: req.params.slug } });
      if (!page) throw new HttpError(404, 'Wiki page not found');
      res.json({ page });
    }),
  );

  r.put(
    '/wiki/:slug',
    officer,
    ah(async (req, res) => {
      const body = parse(z.object({ title: text(120, 1), content: text(40000, 1) }), req.body);
      const slug = slugify(req.params.slug);
      if (!slug) throw new HttpError(400, 'Invalid page name');
      const page = await prisma.wikiPage.upsert({
        where: { slug },
        update: { ...body, updatedById: req.user.id },
        create: { slug, ...body, updatedById: req.user.id },
      });
      res.json({ page });
    }),
  );

  r.delete(
    '/wiki/:slug',
    officer,
    ah(async (req, res) => {
      await prisma.wikiPage.delete({ where: { slug: req.params.slug } });
      await logAction(ctx, req, 'wiki.delete', { slug: req.params.slug });
      res.json({ ok: true });
    }),
  );

  // ================= Votes =================
  const effectiveStatus = (v) => (v.status === 'OPEN' && new Date(v.endTime) < new Date() ? 'CLOSED' : v.status);

  async function describeVote(vote, user) {
    const status = effectiveStatus(vote);
    const records = await prisma.voteRecord.findMany({ where: { voteId: vote.id }, select: { userId: true, optionSelected: true } });
    const options = Array.isArray(vote.options) ? vote.options : [];
    const showResults = status === 'CLOSED' || atLeast(user.role, 'OFFICER');
    return {
      id: vote.id,
      title: vote.title,
      description: vote.description,
      options,
      eligibleRole: vote.eligibleRole,
      startTime: vote.startTime,
      endTime: vote.endTime,
      status,
      eligible: atLeast(user.role, vote.eligibleRole),
      hasVoted: records.some((x) => x.userId === user.id),
      myChoice: records.find((x) => x.userId === user.id)?.optionSelected || null,
      totalVotes: records.length,
      results: showResults ? options.map((o) => ({ option: o, votes: records.filter((x) => x.optionSelected === o).length })) : null,
    };
  }

  r.get(
    '/votes',
    ah(async (req, res) => {
      const votes = await prisma.vote.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
      const visible = votes.filter((v) => v.status !== 'DRAFT' || req.atLeast(user.role, 'OFFICER'));
      res.json({ votes: await Promise.all(visible.map((v) => describeVote(v, req.user))) });
    }),
  );

  r.post(
    '/votes',
    officer,
    ah(async (req, res) => {
      const body = parse(
        z.object({
          title: text(150, 3),
          description: optionalText(1500),
          options: z.array(text(80, 1)).min(2).max(10),
          eligibleRole: z.enum(['MEMBER', 'OFFICER']).default('MEMBER'),
          endTime: z.string().refine((v) => parseDate(v), 'Invalid end time'),
        }),
        req.body,
      );
      if (new Set(body.options).size !== body.options.length) throw new HttpError(400, 'Options must be unique');
      const endTime = parseDate(body.endTime);
      if (endTime <= new Date()) throw new HttpError(400, 'End time must be in the future');
      const vote = await prisma.vote.create({
        data: { ...body, endTime, startTime: new Date(), status: 'OPEN', createdById: req.user.id },
      });
      const members = await prisma.user.findMany({ where: { status: 'ACTIVE' }, select: { id: true, role: true } });
      await notify(ctx, members.filter((m) => atLeast(m.role, vote.eligibleRole)).map((m) => m.id), `New vote: ${vote.title}`, '/app/votes');
      await discordNotify(ctx, `🗳️ New BLC vote: **${vote.title}** — closes ${endTime.toUTCString()}`);
      await logAction(ctx, req, 'vote.create', { id: vote.id });
      res.status(201).json({ vote: await describeVote(vote, req.user) });
    }),
  );

  r.patch(
    '/votes/:id',
    officer,
    ah(async (req, res) => {
      const body = parse(
        z.object({
          status: z.enum(['OPEN', 'CLOSED']).optional(),
          endTime: z.string().optional(),
          title: text(150, 3).optional(),
          description: optionalText(1500),
        }),
        req.body,
      );
      const data = { ...body };
      if (body.endTime) data.endTime = parseDate(body.endTime);
      const vote = await prisma.vote.update({ where: { id: req.params.id }, data });
      await logAction(ctx, req, 'vote.update', { id: vote.id, ...body });
      res.json({ vote: await describeVote(vote, req.user) });
    }),
  );

  r.post(
    '/votes/:id/cast',
    ah(async (req, res) => {
      const { option } = parse(z.object({ option: text(80, 1) }), req.body);
      const vote = await prisma.vote.findUnique({ where: { id: req.params.id } });
      if (!vote || vote.status === 'DRAFT') throw new HttpError(404, 'Vote not found');
      if (effectiveStatus(vote) !== 'OPEN') throw new HttpError(400, 'This vote is closed');
      if (!atLeast(req.user.role, vote.eligibleRole)) throw new HttpError(403, 'You are not eligible for this vote');
      if (!Array.isArray(vote.options) || !vote.options.includes(option)) throw new HttpError(400, 'Invalid option');
      try {
        await prisma.voteRecord.create({ data: { voteId: vote.id, userId: req.user.id, optionSelected: option } });
      } catch (err) {
        if (err.code === 'P2002') throw new HttpError(409, 'You have already voted');
        throw err;
      }
      res.status(201).json({ ok: true });
    }),
  );

  r.get(
    '/votes/history/mine',
    ah(async (req, res) => {
      const records = await prisma.voteRecord.findMany({
        where: { userId: req.user.id },
        include: { vote: { select: { id: true, title: true, status: true } } },
        orderBy: { votedAt: 'desc' },
      });
      res.json({ history: records });
    }),
  );

  return r;
}
