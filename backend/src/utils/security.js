import crypto from 'node:crypto';

/** Random URL-safe token (shown to the user once). */
export const newToken = () => crypto.randomBytes(32).toString('hex');

/** Only the SHA-256 hash of a token is stored in the database. */
export const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

/** Constant-time string comparison (hashes first so lengths never leak). */
export function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a ?? '')).digest();
  const hb = crypto.createHash('sha256').update(String(b ?? '')).digest();
  return crypto.timingSafeEqual(ha, hb);
}
