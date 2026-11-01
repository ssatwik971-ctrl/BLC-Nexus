import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer } from './helpers.js';

let t;
let member;
let officer;
let admin;

beforeAll(async () => {
  t = await startTestServer();
  await t.createUser('MEMBER', 'member');
  await t.createUser('OFFICER', 'officer');
  await t.createUser('ADMIN', 'admin');
  member = await t.login('member@example.com');
  officer = await t.login('officer@example.com');
  admin = await t.login('admin@example.com');
});
afterAll(() => t.close());

const office = { name: 'Test Office', level: 2, weeklyMoneyCost: 1000, weeklyCoinCost: 5 };

describe('role-based access control', () => {
  it('public visitors can read public data but not member data', async () => {
    expect((await t.request('GET', '/api/public/site')).status).toBe(200);
    expect((await t.request('GET', '/api/public/leaderboard')).status).toBe(200);
    expect((await t.request('GET', '/api/offices')).status).toBe(401);
    expect((await t.request('GET', '/api/admin/applications')).status).toBe(401);
  });

  it('members can read offices but cannot create them', async () => {
    expect((await t.request('GET', '/api/offices', { token: member })).status).toBe(200);
    expect((await t.request('POST', '/api/offices', { token: member, body: office })).status).toBe(403);
  });

  it('officers can create offices but cannot delete them or use the admin API', async () => {
    const created = await t.request('POST', '/api/offices', { token: officer, body: office });
    expect(created.status).toBe(201);
    const id = created.body.office.id;
    expect((await t.request('DELETE', `/api/offices/${id}`, { token: officer })).status).toBe(403);
    expect((await t.request('GET', '/api/admin/users', { token: officer })).status).toBe(403);
    expect((await t.request('DELETE', `/api/offices/${id}`, { token: admin })).status).toBe(200);
  });

  it('admins can reach the admin API and responses never include password hashes', async () => {
    const res = await t.request('GET', '/api/admin/users', { token: admin });
    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeGreaterThanOrEqual(3);
    for (const u of res.body.users) expect(u.passwordHash).toBeUndefined();
  });

  it('role changes take effect immediately (no stale token claims)', async () => {
    const m = await t.prisma.user.findUnique({ where: { email: 'member@example.com' } });
    m.role = 'OFFICER';
    expect((await t.request('POST', '/api/offices', { token: member, body: { ...office, name: 'Promoted Office' } })).status).toBe(201);
    m.role = 'MEMBER';
    expect((await t.request('POST', '/api/offices', { token: member, body: { ...office, name: 'Demoted Office' } })).status).toBe(403);
  });

  it('prevents an admin from demoting themselves', async () => {
    const me = await t.prisma.user.findUnique({ where: { email: 'admin@example.com' } });
    const res = await t.request('PATCH', `/api/admin/users/${me.id}`, { token: admin, body: { role: 'MEMBER' } });
    expect(res.status).toBe(400);
  });

  it('strips HTML from user-supplied text', async () => {
    const res = await t.request('POST', '/api/offices', {
      token: admin,
      body: { ...office, name: 'Clean <script>alert(1)</script>Office' },
    });
    expect(res.status).toBe(201);
    expect(res.body.office.name).not.toContain('<script>');
    expect(res.body.office.name).not.toContain('alert');
  });
});
