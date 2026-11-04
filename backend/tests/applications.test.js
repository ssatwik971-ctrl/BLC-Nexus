import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, PASSWORD } from './helpers.js';

let t;
let admin;
let officer;
let applicationToken;
let applicationId;

const application = {
  inGameName: 'Rookie Tycoon',
  playerId: 'P-12345',
  email: 'Rookie@Example.com',
  level: 25,
  power: '1.2M',
  weeklyActivity: 'Daily',
  reason: 'I want to grow with a serious, active cooperative and help with strategy.',
};

beforeAll(async () => {
  t = await startTestServer();
  await t.createUser('OFFICER', 'officer');
  await t.createUser('MEMBER', 'member');
  admin = await t.adminLogin();
  officer = await t.login('officer@example.com');
});
afterAll(() => t.close());

describe('application → approval → account activation', () => {
  it('accepts a public application, returns a private token and emails a confirmation', async () => {
    const res = await t.request('POST', '/api/applications', { body: application });
    expect(res.status).toBe(201);
    expect(res.body.token).toMatch(/^[a-f0-9]{64}$/);
    applicationToken = res.body.token;
    applicationId = res.body.id;
    expect(t.sent.at(-1).to).toBe('rookie@example.com');
  });

  it('stores only a hash of the token', async () => {
    const stored = await t.prisma.application.findUnique({ where: { id: applicationId } });
    expect(stored.tokenHash).toBeTruthy();
    expect(stored.tokenHash).not.toBe(applicationToken);
    expect(JSON.stringify(stored)).not.toContain(applicationToken);
  });

  it('rejects duplicate pending applications and invalid input', async () => {
    expect((await t.request('POST', '/api/applications', { body: application })).status).toBe(409);
    expect((await t.request('POST', '/api/applications', { body: { ...application, reason: 'short' } })).status).toBe(400);
  });

  it('lets the applicant check status by token, and 404s on a wrong token', async () => {
    const ok = await t.request('GET', `/api/applications/status/${applicationToken}`);
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('PENDING');
    expect((await t.request('GET', '/api/applications/status/not-a-real-token')).status).toBe(404);
  });

  it('only the admin can review applications (not members, not officers)', async () => {
    const memberToken = await t.login('member@example.com');
    expect((await t.request('GET', '/api/admin/applications')).status).toBe(401);
    expect((await t.request('GET', '/api/admin/applications', { token: memberToken })).status).toBe(403);
    expect((await t.request('GET', '/api/admin/applications', { token: officer })).status).toBe(403);
    const attempt = await t.request('PATCH', `/api/admin/applications/${applicationId}`, { token: officer, body: { status: 'APPROVED' } });
    expect(attempt.status).toBe(403);
    expect(await t.prisma.user.findUnique({ where: { email: 'rookie@example.com' } })).toBeNull();
    const list = await t.request('GET', '/api/admin/applications', { cookie: admin });
    expect(list.status).toBe(200);
    expect(list.body.applications[0].tokenHash).toBeUndefined();
  });

  let inviteToken;
  it('approving creates an invited member and emails an activation link', async () => {
    const res = await t.request('PATCH', `/api/admin/applications/${applicationId}`, {
      cookie: admin,
      body: { status: 'APPROVED', note: 'Welcome aboard' },
    });
    expect(res.status).toBe(200);
    const user = await t.prisma.user.findUnique({ where: { email: 'rookie@example.com' } });
    expect(user.status).toBe('INVITED');
    expect(user.role).toBe('MEMBER');

    const invite = t.sent.at(-1);
    expect(invite.to).toBe('rookie@example.com');
    inviteToken = /accept-invite\?token=([a-f0-9]+)/.exec(invite.text)?.[1];
    expect(inviteToken).toBeTruthy();

    const status = await t.request('GET', `/api/applications/status/${applicationToken}`);
    expect(status.body.status).toBe('APPROVED');
  });

  it('cannot approve the same application twice', async () => {
    const res = await t.request('PATCH', `/api/admin/applications/${applicationId}`, {
      cookie: admin,
      body: { status: 'APPROVED' },
    });
    expect(res.status).toBe(409);
  });

  it('an invited member cannot log in until they activate', async () => {
    const res = await t.request('POST', '/api/auth/login', { body: { email: 'rookie@example.com', password: PASSWORD } });
    expect(res.status).toBe(401);
  });

  it('activating with the invite link sets a password and logs the member in', async () => {
    const weak = await t.request('POST', '/api/auth/accept-invite', { body: { token: inviteToken, password: 'short' } });
    expect(weak.status).toBe(400);

    const res = await t.request('POST', '/api/auth/accept-invite', { body: { token: inviteToken, password: PASSWORD } });
    expect(res.status).toBe(200);
    expect(res.body.user.status).toBe('ACTIVE');

    const login = await t.request('POST', '/api/auth/login', { body: { email: 'rookie@example.com', password: PASSWORD } });
    expect(login.status).toBe(200);

    // the invite link is single-use
    const reuse = await t.request('POST', '/api/auth/accept-invite', { body: { token: inviteToken, password: PASSWORD } });
    expect(reuse.status).toBe(400);
  });

  it('rejecting an application emails the applicant', async () => {
    const second = await t.request('POST', '/api/applications', {
      body: { ...application, inGameName: 'Other Player', playerId: 'P-999', email: 'other@example.com' },
    });
    const res = await t.request('PATCH', `/api/admin/applications/${second.body.id}`, {
      cookie: admin,
      body: { status: 'REJECTED', note: 'Not enough activity yet' },
    });
    expect(res.status).toBe(200);
    expect(t.sent.at(-1).to).toBe('other@example.com');
  });
});
