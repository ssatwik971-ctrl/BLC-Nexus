import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { HttpError, ah, parse, publicUser } from '../utils/http.js';
import { newToken, sha256 } from '../utils/security.js';
import { inviteEmail, resetEmail } from '../utils/emails.js';

const password = z.string().min(10, 'Use at least 10 characters').max(128);
// Used to keep response time similar whether or not the account exists.
const DUMMY_HASH = bcrypt.hashSync('blc-nexus-timing-equalizer', 4);

export default function authRoutes(ctx, auth, limiters) {
  const r = Router();
  const { prisma, config, mailer } = ctx;
  const identityEnabled = Boolean(ctx.identityMode);
  const legacyAuthDisabled = (_req, _res, next) => identityEnabled
    ? next(new HttpError(410, 'Password authentication has moved to Netlify Identity.'))
    : next();

  r.post(
    '/login',
    legacyAuthDisabled,
    limiters.login,
    ah(async (req, res) => {
      const { email, password: pw } = parse(
        z.object({ email: z.string().email().max(254), password: z.string().min(1).max(128) }),
        req.body,
      );
      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      const ok = await bcrypt.compare(pw, user?.passwordHash || DUMMY_HASH);
      if (!user || !user.passwordHash || !ok || user.status !== 'ACTIVE') {
        throw new HttpError(401, 'Invalid email or password');
      }
      res.json({ token: auth.signToken(user), user: publicUser(user) });
    }),
  );

  r.post(
    '/accept-invite',
    legacyAuthDisabled,
    limiters.login,
    ah(async (req, res) => {
      const { token, password: pw } = parse(z.object({ token: z.string().min(10).max(200), password }), req.body);
      const user = await prisma.user.findUnique({ where: { inviteTokenHash: sha256(token) } });
      if (!user || user.status !== 'INVITED' || !user.inviteExpires || user.inviteExpires < new Date()) {
        throw new HttpError(400, 'This invite link is invalid or has expired');
      }
      const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await bcrypt.hash(pw, config.bcryptRounds),
          status: 'ACTIVE',
          inviteTokenHash: null,
          inviteExpires: null,
          mustChangePassword: false,
        },
      });
      res.json({ token: auth.signToken(updated), user: publicUser(updated) });
    }),
  );

  r.post(
    '/forgot-password',
    legacyAuthDisabled,
    limiters.login,
    ah(async (req, res) => {
      const { email } = parse(z.object({ email: z.string().email().max(254) }), req.body);
      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (user && user.status === 'ACTIVE') {
        const token = newToken();
        await prisma.user.update({
          where: { id: user.id },
          data: { resetTokenHash: sha256(token), resetExpires: new Date(Date.now() + 60 * 60 * 1000) },
        });
        await mailer.send({ to: user.email, ...resetEmail(config, user, token) });
      }
      // Same response either way so emails cannot be enumerated.
      res.json({ ok: true });
    }),
  );

  r.post(
    '/reset-password',
    legacyAuthDisabled,
    limiters.login,
    ah(async (req, res) => {
      const { token, password: pw } = parse(z.object({ token: z.string().min(10).max(200), password }), req.body);
      const user = await prisma.user.findUnique({ where: { resetTokenHash: sha256(token) } });
      if (!user || !user.resetExpires || user.resetExpires < new Date()) {
        throw new HttpError(400, 'This reset link is invalid or has expired');
      }
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await bcrypt.hash(pw, config.bcryptRounds),
          resetTokenHash: null,
          resetExpires: null,
          mustChangePassword: false,
        },
      });
      res.json({ ok: true });
    }),
  );

  r.get('/me', auth.authenticate, (req, res) => res.json({ user: publicUser(req.user) }));

  // Link a verified Netlify Identity subject to an already-approved BLC record.
  // Linking by email is permitted only when that address is already in the club database.
  if (identityEnabled) {
    r.post('/identity/link', async (req, res, next) => {
      try {
        const identityId = req.headers['x-blc-verified-identity-id'];
        const email = String(req.headers['x-blc-verified-identity-email'] || '').toLowerCase();
        if (!identityId || !email || req.headers['x-blc-verified-identity-confirmed'] !== 'true') throw new HttpError(401, 'Use a confirmed Netlify Identity account first');
        const target = await prisma.user.findUnique({ where: { email } });
        const confirmed = req.headers['x-blc-verified-identity-confirmed'] === 'true';
        if (!target || (target.status !== 'ACTIVE' && !(target.status === 'INVITED' && confirmed))) throw new HttpError(403, 'This email is not linked to an approved BLC Nexus membership');
        if (target.netlifyIdentityId && target.netlifyIdentityId !== identityId) throw new HttpError(409, 'This membership is already linked to another Identity account');
        const linked = await prisma.user.update({ where: { id: target.id }, data: { netlifyIdentityId: identityId, status: 'ACTIVE', inviteTokenHash: null, inviteExpires: null, passwordHash: null, mustChangePassword: false } });
        res.json({ user: publicUser(linked) });
      } catch (error) { next(error); }
    });
  }

  r.post(
    '/change-password',
    legacyAuthDisabled,
    auth.authenticate,
    ah(async (req, res) => {
      const { currentPassword, newPassword } = parse(
        z.object({ currentPassword: z.string().min(1).max(128), newPassword: password }),
        req.body,
      );
      const ok = await bcrypt.compare(currentPassword, req.user.passwordHash || DUMMY_HASH);
      if (!ok) throw new HttpError(400, 'Current password is incorrect');
      await prisma.user.update({
        where: { id: req.user.id },
        data: { passwordHash: await bcrypt.hash(newPassword, config.bcryptRounds), mustChangePassword: false },
      });
      res.json({ ok: true });
    }),
  );

  return r;
}

/** Create an invite token for a user and email it. Shared with admin routes. */
export async function sendInvite(ctx, user) {
  if (ctx.identityMode) {
    // Netlify Identity invitations are sent from Project configuration > Identity > Users.
    // Do not send the obsolete password-reset/JWT invite email in Identity mode.
    return null;
  }
  const token = newToken();
  const updated = await ctx.prisma.user.update({
    where: { id: user.id },
    data: {
      inviteTokenHash: sha256(token),
      inviteExpires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      status: 'INVITED',
    },
  });
  await ctx.mailer.send({ to: updated.email, ...inviteEmail(ctx.config, updated, token) });
  return token;
}
