import 'dotenv/config';
import path from 'node:path';

const env = process.env;
const nodeEnv = env.NODE_ENV || 'development';
const isProd = nodeEnv === 'production';
const isTest = nodeEnv === 'test';

const list = (v, fallback) =>
  (v || fallback || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

export const config = {
  env: nodeEnv,
  isProd,
  isTest,
  port: Number(env.PORT || 4000),
  siteName: env.SITE_NAME || 'BLC Nexus',
  tagline: 'The Command Center of the Billionaires Club',
  frontendUrl: (env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, ''),
  corsOrigins: list(env.CORS_ORIGINS, env.FRONTEND_URL || 'http://localhost:5173'),
  jwtSecret: env.JWT_SECRET || (isProd ? '' : 'dev-only-secret-change-me-please'),
  jwtExpiresIn: env.JWT_EXPIRES_IN || '7d',
  bcryptRounds: isTest ? 4 : 12,
  uploadDir: env.UPLOAD_DIR ? path.resolve(env.UPLOAD_DIR) : path.resolve('uploads'),
  maxUploadMb: Number(env.MAX_UPLOAD_MB || 4),
  contactEmail: env.CONTACT_EMAIL || '',
  mailFrom: env.MAIL_FROM || 'BLC Nexus <no-reply@blcnexus.local>',
  smtp: {
    host: env.SMTP_HOST || '',
    port: Number(env.SMTP_PORT || 587),
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
  },
  discordWebhookUrl: env.DISCORD_WEBHOOK_URL || '',
  // The one admin account. Set ADMIN_EMAIL and ADMIN_PIN in the Netlify environment
  // variables; there is no admin row in the database until that person signs in.
  adminEmail: (env.ADMIN_EMAIL || '').trim().toLowerCase(),
  adminPin: env.ADMIN_PIN || '',
  adminName: env.ADMIN_NAME || 'BLC Admin',
  adminSessionHours: Number(env.ADMIN_SESSION_HOURS || 12),
  rateLimitDisabled: isTest || env.RATE_LIMIT_DISABLED === 'true',
};

export function assertConfig(cfg = config) {
  if (!cfg.jwtSecret || cfg.jwtSecret.length < 16) {
    throw new Error('JWT_SECRET must be set to a random string of at least 16 characters.');
  }
}
