import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { makeAuth } from './middleware/auth.js';
import { makeLimiters } from './middleware/rateLimit.js';
import { errorHandler, notFound } from './middleware/error.js';
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';
import memberRoutes from './routes/members.js';
import opsRoutes from './routes/ops.js';
import communityRoutes from './routes/community.js';
import vaultRoutes from './routes/vault.js';

/**
 * Build the Express app. Dependencies are injected via `ctx`
 * ({ prisma, config, mailer, logger }) so tests can supply fakes.
 */
export function createApp(ctx) {
  const { config, logger } = ctx;
  const app = express();
  const auth = makeAuth(ctx);
  const limiters = makeLimiters(config);

  app.set('trust proxy', 1); // Railway/Render/Vercel sit behind a proxy
  app.disable('x-powered-by');

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'blc-nexus-api' }));

  // Enforce HTTPS in production (health check stays reachable for platform probes).
  if (config.isProd) {
    app.use((req, res, next) =>
      req.secure ? next() : res.redirect(301, `https://${req.headers.host}${req.originalUrl}`),
    );
  }

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      origin: (origin, cb) => cb(null, !origin || config.corsOrigins.includes(origin)),
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    }),
  );
  app.use(express.json({ limit: '200kb' }));
  app.use('/api', limiters.general);

  // ---- Public (no login) ----
  app.use('/api/auth', authRoutes(ctx, auth, limiters));
  app.use('/api', publicRoutes(ctx, limiters));

  // ---- Admin only ----
  app.use('/api/admin', auth.authenticate, auth.requireRole('ADMIN'), adminRoutes(ctx));

  // ---- Members and above (RBAC is enforced per route inside each router) ----
  app.use('/api', auth.authenticate, memberRoutes(ctx));
  app.use('/api', auth.authenticate, opsRoutes(ctx, auth));
  app.use('/api', auth.authenticate, communityRoutes(ctx, auth, limiters));
  app.use('/api', auth.authenticate, vaultRoutes(ctx, auth));

  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
