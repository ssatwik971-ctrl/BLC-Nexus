import sanitizeHtml from 'sanitize-html';
import { z } from 'zod';

export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Wrap an async route handler so rejections reach the error middleware. */
export const ah = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

/** Validate data against a zod schema or throw a 400. */
export function parse(schema, data) {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    throw new HttpError(400, 'Validation failed', result.error.flatten());
  }
  return result.data;
}

const ENTITIES = [
  ['&lt;', '<'],
  ['&gt;', '>'],
  ['&quot;', '"'],
  ['&#39;', "'"],
  ['&amp;', '&'],
];

/**
 * Strip all HTML tags/attributes and control characters from user text.
 * Content is stored as plain text and always rendered escaped (React / esc()).
 */
export function clean(value) {
  let s = sanitizeHtml(String(value ?? ''), { allowedTags: [], allowedAttributes: {} });
  for (const [entity, char] of ENTITIES) s = s.split(entity).join(char);
  return s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();
}

/** zod string that is sanitised, trimmed and length-bounded. */
export const text = (max, min = 0) =>
  z.string().transform(clean).pipe(z.string().min(min).max(max));

export const optionalText = (max) =>
  z
    .string()
    .transform(clean)
    .pipe(z.string().max(max))
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const ROLE_RANK = { MEMBER: 1, OFFICER: 2, ADMIN: 3 };
export const atLeast = (role, min) => (ROLE_RANK[role] || 0) >= ROLE_RANK[min];

/** Remove secrets before sending a user to a client. */
export function publicUser(u) {
  if (!u) return null;
  const {
    passwordHash,
    inviteTokenHash,
    inviteExpires,
    resetTokenHash,
    resetExpires,
    ...safe
  } = u;
  return safe;
}

export const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
