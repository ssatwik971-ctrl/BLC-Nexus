import bcrypt from 'bcryptjs';
import { createApp } from '../src/app.js';
import { createFakePrisma } from './fakePrisma.js';

export const PASSWORD = 'CorrectHorse!42';

/** Start the real Express app on a random port against an in-memory fake DB. */
export async function startTestServer() {
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
  };
  const mailer = { send: async (mail) => void sent.push(mail) };
  const logger = { info() {}, warn() {}, error() {}, debug() {} };
  const app = createApp({ prisma, config, mailer, logger });

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://127.0.0.1:${server.address().port}`;

  async function request(method, path, { token, body } = {}) {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      /* empty body */
    }
    return { status: res.status, body: json };
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

  return { prisma, sent, request, createUser, login, close: () => new Promise((r) => server.close(r)) };
}
