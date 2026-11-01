import crypto from 'node:crypto';

/** Random URL-safe token (shown to the user once). */
export const newToken = () => crypto.randomBytes(32).toString('hex');

/** Only the SHA-256 hash of a token is stored in the database. */
export const sha256 = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');
