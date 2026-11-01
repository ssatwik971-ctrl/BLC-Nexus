import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, PASSWORD } from './helpers.js';

let t;
beforeAll(async () => {
  t = await startTestServer();
  await t.createUser('MEMBER', 'member');
  const suspended = await t.createUser('MEMBER', 'suspended');
  suspended.status = 'SUSPENDED';
});
afterAll(() => t.close());

describe('authentication', () => {
  it('logs in with valid credentials and never returns the password hash', async () => {
    const res = await t.request('POST', '/api/auth/login', {
      body: { email: 'member@example.com', password: PASSWORD },
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('member@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a wrong password and an unknown email with the same error', async () => {
    const wrong = await t.request('POST', '/api/auth/login', { body: { email: 'member@example.com', password: 'nope-nope-nope' } });
    const unknown = await t.request('POST', '/api/auth/login', { body: { email: 'ghost@example.com', password: PASSWORD } });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error).toBe(unknown.body.error);
  });

  it('blocks suspended accounts', async () => {
    const res = await t.request('POST', '/api/auth/login', { body: { email: 'suspended@example.com', password: PASSWORD } });
    expect(res.status).toBe(401);
  });

  it('requires a token for /auth/me and accepts a valid one', async () => {
    expect((await t.request('GET', '/api/auth/me')).status).toBe(401);
    const token = await t.login('member@example.com');
    const me = await t.request('GET', '/api/auth/me', { token });
    expect(me.status).toBe(200);
    expect(me.body.user.inGameName).toBe('member');
  });

  it('rejects a tampered token', async () => {
    const token = await t.login('member@example.com');
    const res = await t.request('GET', '/api/auth/me', { token: token.slice(0, -3) + 'abc' });
    expect(res.status).toBe(401);
  });

  it('forgot-password responds identically for unknown emails and sends nothing', async () => {
    const before = t.sent.length;
    const res = await t.request('POST', '/api/auth/forgot-password', { body: { email: 'ghost@example.com' } });
    expect(res.status).toBe(200);
    expect(t.sent.length).toBe(before);
  });

  it('validates input', async () => {
    const res = await t.request('POST', '/api/auth/login', { body: { email: 'not-an-email', password: '' } });
    expect(res.status).toBe(400);
  });
});
