import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { createFakePrisma } from './fakePrisma.js';

export const PASSWORD = 'CorrectHorse!42';
export const ADMIN_EMAIL = 'owner@gmail.com';
export const ADMIN_PIN = 'Pin-9482';

/** Start the real Express app on a random port against an in-memory fake DB. */
export async function startTestServer(overrides = {}) {
  const prisma = createFakePrisma();
  const sent = [];
  const config = {
    env: 'test',
    isProd: false,
    isTest: true,
    siteName: 'BLC Nexus',
    tagline: 'The Command Center of the Billionaires Club',
    frontendUrl: 'http://localhost:5173',
    corsOrigins: ['http://localhost:5173'],
    jwtSecret: 'test-secret-test-secret',
    jwtExpiresIn: '1h',
    bcryptRounds: 4,
    uploadDir: new URL('../.test-uploads', import.meta.url).pathname,
    maxUploadMb: 1,
    contactEmail: '',
    mailFrom: 'test@example.com',
    smtp: {},
    discordWebhookUrl: '',
    rateLimitDisabled: true,
    adminEmail: ADMIN_EMAIL,
    adminPin: ADMIN_PIN,
    adminName: 'Test Admin',
    adminSessionHours: 1,
    ...overrides,
  };
  const mailer = { send: async (mail) => void sent.push(mail) };
  const logger = { info() {}, warn() {}, error() {}, debug() {} };
  const app = createApp({ prisma, config, mailer, logger });

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  async function request(method, path, { token, cookie, body } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(cookie ? { Cookie: cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      /* empty body */
    }
    return { status: res.status, body: json, setCookie: res.headers.get('set-cookie') };
  }

  async function createUser(role, name = role.toLowerCase()) {
    return prisma.user.create({
      data: {
        email: `${name}@example.com`,
        inGameName: name,
        role,
        status: 'ACTIVE',
        passwordHash: await bcrypt.hash(PASSWORD, 4),
      },
    });
  }

  async function login(email) {
    const res = await request('POST', '/api/auth/login', { body: { email, password: PASSWORD } });
    return res.body?.token;
  }

  /** Sign in as the admin with ADMIN_EMAIL + ADMIN_PIN; returns the session cookie to send back. */
  async function adminLogin(email = ADMIN_EMAIL, pin = ADMIN_PIN) {
    const res = await request('POST', '/api/auth/admin-login', { body: { email, pin } });
    return res.setCookie ? res.setCookie.split(';')[0] : null;
  }

  return { prisma, sent, config, request, adminLogin, createUser, login, close: () => new Promise((r) => server.close(r)) };
}
