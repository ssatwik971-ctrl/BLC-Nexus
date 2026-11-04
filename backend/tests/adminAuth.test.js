import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { startTestServer, ADMIN_EMAIL, ADMIN_PIN, PASSWORD } from './helpers.js';

describe('admin sign-in with ADMIN_EMAIL + ADMIN_PIN', () => {
  let t;
  beforeAll(async () => {
    t = await startTestServer();
  });
  afterAll(() => t.close());

  it('there is no admin account until the admin signs in (no demo admin)', async () => {
    expect(await t.prisma.user.count({ where: { role: 'ADMIN' } })).toBe(0);
  });

  it('rejects a wrong PIN or wrong email with the same message and no session', async () => {
    const wrongPin = await t.request('POST', '/api/auth/admin-login', { body: { email: ADMIN_EMAIL, pin: 'nope-nope' } });
    const wrongEmail = await t.request('POST', '/api/auth/admin-login', { body: { email: 'someone@gmail.com', pin: ADMIN_PIN } });
    expect(wrongPin.status).toBe(401);
    expect(wrongEmail.status).toBe(401);
    expect(wrongPin.body.error).toBe(wrongEmail.body.error);
    expect(wrongPin.setCookie).toBeNull();
    expect(await t.prisma.adminSession.count()).toBe(0);
  });

  it('signs in with the right email (any letter case) and PIN, and sets a hardened cookie', async () => {
    const res = await t.request('POST', '/api/auth/admin-login', { body: { email: ` ${ADMIN_EMAIL.toUpperCase()} `, pin: ADMIN_PIN } });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('ADMIN');
    expect(res.body.user.email).toBe(ADMIN_EMAIL);
    expect(res.setCookie).toMatch(/^blc_admin=/);
    expect(res.setCookie).toMatch(/HttpOnly/);
    expect(res.setCookie).toMatch(/SameSite=Strict/);
    // the token itself is never stored, only its hash
    const token = decodeURIComponent(res.setCookie.split(';')[0].split('=')[1]);
    const [row] = t.prisma.adminSession.rows;
    expect(row.tokenHash).toBeTruthy();
    expect(row.tokenHash).not.toBe(token);
  });

  it('the session cookie grants admin access; without it there is none', async () => {
    const cookie = await t.adminLogin();
    expect(cookie).toBeTruthy();
    expect((await t.request('GET', '/api/auth/me', { cookie })).body.user.role).toBe('ADMIN');
    expect((await t.request('GET', '/api/admin/applications', { cookie })).status).toBe(200);
    expect((await t.request('GET', '/api/auth/me')).status).toBe(401);
    expect((await t.request('GET', '/api/auth/me', { cookie: 'blc_admin=forged' })).status).toBe(401);
  });

  it('logout destroys the session on the server', async () => {
    const cookie = await t.adminLogin();
    expect((await t.request('POST', '/api/auth/admin-logout', { cookie })).status).toBe(200);
    expect((await t.request('GET', '/api/auth/me', { cookie })).status).toBe(401);
  });

  it('changing ADMIN_PIN in the environment signs old sessions out', async () => {
    const cookie = await t.adminLogin();
    expect((await t.request('GET', '/api/auth/me', { cookie })).status).toBe(200);
    const oldPin = t.config.adminPin;
    t.config.adminPin = 'A-brand-new-PIN-77';
    try {
      expect((await t.request('GET', '/api/auth/me', { cookie })).status).toBe(401);
    } finally {
      t.config.adminPin = oldPin;
    }
  });

  it('expired sessions are refused', async () => {
    const cookie = await t.adminLogin();
    t.prisma.adminSession.rows.forEach((r) => { r.expiresAt = new Date(Date.now() - 1000); });
    expect((await t.request('GET', '/api/auth/me', { cookie })).status).toBe(401);
  });

  it('a user row with the ADMIN role can NOT sign in with a password or an old token', async () => {
    const stale = await t.prisma.user.create({
      data: { email: 'old-admin@example.com', inGameName: 'OldAdmin', role: 'ADMIN', status: 'ACTIVE', passwordHash: await bcrypt.hash(PASSWORD, 4) },
    });
    const login = await t.request('POST', '/api/auth/login', { body: { email: stale.email, password: PASSWORD } });
    expect(login.status).toBe(401);
    // ...and a hand-made token for that row is useless too
    const token = jwt.sign({ sub: stale.id, role: 'ADMIN' }, t.config.jwtSecret);
    expect((await t.request('GET', '/api/auth/me', { token })).status).toBe(401);
    expect((await t.request('GET', '/api/admin/applications', { token })).status).toBe(401);
  });

  it('the admin email cannot be used to sign in as a normal member either', async () => {
    const r = await t.request('POST', '/api/auth/login', { body: { email: ADMIN_EMAIL, password: PASSWORD } });
    expect(r.status).toBe(401);
  });
});

describe('admin sign-in lockout and configuration', () => {
  it('locks out an address after 5 failed attempts, even for the right PIN', async () => {
    const t = await startTestServer();
    try {
      for (let i = 0; i < 5; i++) {
        expect((await t.request('POST', '/api/auth/admin-login', { body: { email: ADMIN_EMAIL, pin: `wrong-${i}` } })).status).toBe(401);
      }
      const blocked = await t.request('POST', '/api/auth/admin-login', { body: { email: ADMIN_EMAIL, pin: ADMIN_PIN } });
      expect(blocked.status).toBe(429);
      expect(blocked.setCookie).toBeNull();
    } finally {
      await t.close();
    }
  });

  it('is disabled when ADMIN_EMAIL / ADMIN_PIN are missing or the PIN is too short', async () => {
    for (const overrides of [{ adminEmail: '' }, { adminPin: '' }, { adminPin: '12345' }]) {
      const t = await startTestServer(overrides);
      try {
        const res = await t.request('POST', '/api/auth/admin-login', { body: { email: ADMIN_EMAIL, pin: ADMIN_PIN } });
        expect(res.status).toBe(503);
        expect(res.setCookie).toBeNull();
      } finally {
        await t.close();
      }
    }
  });

});
