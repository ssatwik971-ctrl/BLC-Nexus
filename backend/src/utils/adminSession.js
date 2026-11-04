import { newToken, sha256, safeEqual } from './security.js';

/**
 * The BLC admin is not a normal member. They sign in with the ADMIN_EMAIL and
 * ADMIN_PIN environment variables and get a random, server-side session that is
 * stored (hashed) in the AdminSession table and sent as an HttpOnly cookie.
 */
export const ADMIN_COOKIE = 'blc_admin';
export const MIN_PIN_LENGTH = 6;

export const adminConfigured = (config) =>
  Boolean(config.adminEmail) && String(config.adminPin || '').length >= MIN_PIN_LENGTH;

// Ties a session to the current PIN + email. Needs the cookie token to compute, so a
// leaked database row cannot be used to guess the PIN offline.
const pinCheck = (config, token) => sha256(`${token}|${config.adminEmail}|${config.adminPin}`);

export function readCookie(req, name) {
  const header = req.headers?.cookie || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

function cookieString(value, { maxAgeSeconds, secure }) {
  return [
    `${ADMIN_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ');
}

/** Make sure the admin has a database row (needed for foreign keys such as forum posts). */
export async function ensureAdminUser(prisma, config) {
  const existing = await prisma.user.findUnique({ where: { email: config.adminEmail } });
  if (existing) {
    if (existing.role === 'ADMIN' && existing.status === 'ACTIVE') return existing;
    return prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN', status: 'ACTIVE' } });
  }
  return prisma.user.create({
    data: { email: config.adminEmail, inGameName: config.adminName, role: 'ADMIN', status: 'ACTIVE' },
  });
}

/** Create a session and set the cookie on the response. */
export async function startAdminSession(ctx, req, res) {
  const { prisma, config } = ctx;
  const token = newToken();
  const maxAgeSeconds = Math.max(1, Math.round((config.adminSessionHours || 12) * 3600));
  await prisma.adminSession.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.adminSession.create({
    data: { tokenHash: sha256(token), pinCheck: pinCheck(config, token), expiresAt: new Date(Date.now() + maxAgeSeconds * 1000) },
  });
  res.setHeader('Set-Cookie', cookieString(token, { maxAgeSeconds, secure: Boolean(req.secure) }));
}

export async function endAdminSession(ctx, req, res) {
  const token = readCookie(req, ADMIN_COOKIE);
  if (token) await ctx.prisma.adminSession.deleteMany({ where: { tokenHash: sha256(token) } });
  res.setHeader('Set-Cookie', cookieString('', { maxAgeSeconds: 0, secure: Boolean(req.secure) }));
}

/** Return the admin user if the request carries a valid admin session cookie. */
export async function loadAdminFromCookie(ctx, req) {
  const { prisma, config } = ctx;
  if (!adminConfigured(config)) return null;
  const token = readCookie(req, ADMIN_COOKIE);
  if (!token) return null;
  const session = await prisma.adminSession.findUnique({ where: { tokenHash: sha256(token) } });
  if (!session || session.expiresAt < new Date()) return null;
  if (!safeEqual(session.pinCheck, pinCheck(config, token))) return null; // PIN or email was changed
  const user = await prisma.user.findUnique({ where: { email: config.adminEmail } });
  return user && user.role === 'ADMIN' && user.status === 'ACTIVE' ? user : null;
}
