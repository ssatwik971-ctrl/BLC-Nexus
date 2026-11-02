import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { HttpError, ah, parse, text, optionalText, ROLE_RANK, atLeast } from '../utils/http.js';
import { parseDate, dayStart } from '../utils/dates.js';
import { makeUpload } from '../middleware/upload.js';
import { logAction } from '../utils/notify.js';

/** Document vault + performance/audit snapshots. */
export default function vaultRoutes(ctx, auth) {
  const r = Router();
  const { prisma, config } = ctx;
  const admin = auth.requireRole('ADMIN');
  const upload = makeUpload(config, { memoryStorage: Boolean(ctx.blobStore) });

  const removeFile = async (storedName) => {
    if (!storedName) return;
    // storedName is server-generated (uuid + ext); basename guards against traversal anyway.
    if (ctx.blobStore) { await ctx.blobStore.delete(storedName); return; }
    try { await fs.promises.unlink(path.join(config.uploadDir, path.basename(storedName))); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  };

  // ---------- Documents ----------
  r.get(
    '/documents',
    ah(async (req, res) => {
      const docs = await prisma.document.findMany({ orderBy: [{ category: 'asc' }, { title: 'asc' }] });
      const rank = ROLE_RANK[req.user.role];
      res.json({
        documents: docs
          .filter((d) => rank >= ROLE_RANK[d.visibleToRole])
          .map(({ storedName, ...d }) => ({ ...d, fileUrl: `/api/documents/${d.id}/download` })),
      });
    }),
  );

  r.post(
    '/documents',
    admin,
    upload.single('file'),
    ah(async (req, res) => {
      const file = req.file;
      let storedName;
      try {
        if (!file) throw new HttpError(400, 'A file is required');
        const body = parse(
          z.object({
            title: text(120, 1),
            description: optionalText(400),
            category: text(60, 1).default('General'),
            visibleToRole: z.enum(['MEMBER', 'OFFICER', 'ADMIN']).default('MEMBER'),
          }),
          req.body,
        );
        storedName = file.filename || `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`;
        if (ctx.blobStore) {
          await ctx.blobStore.set(storedName, file.buffer.buffer.slice(file.buffer.byteOffset, file.buffer.byteOffset + file.buffer.byteLength), { metadata: { originalName: path.basename(file.originalname).slice(0, 200), mimeType: file.mimetype } });
        }
        const doc = await prisma.document.create({
          data: {
            ...body,
            fileName: path.basename(file.originalname).slice(0, 200),
            storedName,
            mimeType: file.mimetype,
            size: file.size,
            uploadedById: req.user.id,
          },
        });
        await logAction(ctx, req, 'document.upload', { id: doc.id, title: doc.title });
        const { storedName: _omit, ...safe } = doc;
        res.status(201).json({ document: safe });
      } catch (err) {
        if (file && storedName) {
          try { await removeFile(storedName); }
          catch (cleanupError) { ctx.logger?.warn?.(`document upload cleanup failed: ${cleanupError.message}`); }
        }
        throw err;
      }
    }),
  );

  r.get(
    '/documents/:id/download',
    ah(async (req, res) => {
      const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
      // 404 (not 403) for hidden docs so their existence is not revealed.
      if (!doc || !atLeast(req.user.role, doc.visibleToRole)) throw new HttpError(404, 'Document not found');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (ctx.blobStore) {
        const bytes = await ctx.blobStore.get(doc.storedName, { type: 'arrayBuffer' });
        if (!bytes) throw new HttpError(404, 'File is missing from storage');
        res.setHeader('Content-Type', doc.mimeType);
        res.setHeader('Content-Length', String(bytes.byteLength));
        res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`);
        return res.status(200).send(Buffer.from(bytes));
      }
      const filePath = path.join(config.uploadDir, path.basename(doc.storedName));
      if (!fs.existsSync(filePath)) throw new HttpError(404, 'File is missing from storage');
      res.download(filePath, doc.fileName);
    }),
  );

  r.patch(
    '/documents/:id',
    admin,
    ah(async (req, res) => {
      const body = parse(
        z.object({
          title: text(120, 1).optional(),
          description: optionalText(400),
          category: text(60, 1).optional(),
          visibleToRole: z.enum(['MEMBER', 'OFFICER', 'ADMIN']).optional(),
        }),
        req.body,
      );
      const { storedName, ...doc } = await prisma.document.update({ where: { id: req.params.id }, data: body });
      await logAction(ctx, req, 'document.update', { id: doc.id });
      res.json({ document: doc });
    }),
  );

  r.delete(
    '/documents/:id',
    admin,
    ah(async (req, res) => {
      const doc = await prisma.document.findUnique({ where: { id: req.params.id } });
      if (!doc) throw new HttpError(404, 'Document not found');
      await prisma.document.delete({ where: { id: doc.id } });
      try { await removeFile(doc.storedName); }
      catch (cleanupError) {
        // The DB row is already gone, so fail closed and log the orphan for later cleanup.
        ctx.logger?.error?.(`orphaned document blob ${doc.storedName}: ${cleanupError.message}`);
      }
      await logAction(ctx, req, 'document.delete', { id: doc.id, title: doc.title });
      res.json({ ok: true });
    }),
  );

  // ---------- Performance snapshots ----------
  r.get(
    '/audit/snapshots',
    ah(async (_req, res) => {
      res.json({ snapshots: await prisma.auditSnapshot.findMany({ orderBy: { date: 'asc' }, take: 500 }) });
    }),
  );

  r.post(
    '/audit/snapshots',
    admin,
    ah(async (req, res) => {
      const body = parse(
        z.object({
          date: z.string().refine((v) => parseDate(v), 'Invalid date'),
          power: z.coerce.number().min(0),
          rank: z.coerce.number().int().min(1).optional().nullable(),
          memberCount: z.coerce.number().int().min(0).optional().nullable(),
          notes: optionalText(300),
        }),
        req.body,
      );
      const snapshot = await prisma.auditSnapshot.create({
        data: { ...body, date: dayStart(parseDate(body.date)), rank: body.rank ?? null, memberCount: body.memberCount ?? null },
      });
      await logAction(ctx, req, 'snapshot.create', { id: snapshot.id });
      res.status(201).json({ snapshot });
    }),
  );

  r.delete(
    '/audit/snapshots/:id',
    admin,
    ah(async (req, res) => {
      await prisma.auditSnapshot.delete({ where: { id: req.params.id } });
      res.json({ ok: true });
    }),
  );

  return r;
}
