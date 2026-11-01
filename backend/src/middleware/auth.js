import jwt from 'jsonwebtoken';
import { HttpError, ah, ROLE_RANK } from '../utils/http.js';

/**
 * Authentication + RBAC middleware factory.
 * Users are re-loaded from the database on every request so role changes and
 * suspensions take effect immediately (no stale JWT claims).
 */
export function makeAuth(ctx) {
  const { prisma, config } = ctx;

  async function loadUser(req) {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
    if (!token) return null;
    let payload;
    try {
      payload = jwt.verify(token, config.jwtSecret);
    } catch {
      return null;
    }
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    return user && user.status === 'ACTIVE' ? user : null;
  }

  const authenticate = ah(async (req, _res, next) => {
    const user = await loadUser(req);
    if (!user) throw new HttpError(401, 'Authentication required');
    req.user = user;
    next();
  });

  /** Minimum role gate. Must run after `authenticate`. */
  const requireRole = (min) => (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, 'Authentication required'));
    if ((ROLE_RANK[req.user.role] || 0) < ROLE_RANK[min]) {
      return next(new HttpError(403, 'You do not have permission to do that'));
    }
    return next();
  };

  const signToken = (user) =>
    jwt.sign({ sub: user.id, role: user.role }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

  return { authenticate, requireRole, signToken };
}
