import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, ADMIN_EMAIL } from './helpers.js';

let t;
let member;
let officer;
let admin;
let memberUser;
let officerUser;

beforeAll(async () => {
  t = await startTestServer();
  memberUser = await t.createUser('MEMBER', 'member');
  officerUser = await t.createUser('OFFICER', 'officer');
  member = await t.login('member@example.com');
  officer = await t.login('officer@example.com');
  admin = await t.adminLogin();
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

  it('members can read offices but cannot manage anything', async () => {
    expect((await t.request('GET', '/api/offices', { token: member })).status).toBe(200);
    expect((await t.request('POST', '/api/offices', { token: member, body: office })).status).toBe(403);
    expect((await t.request('GET', '/api/admin/users', { token: member })).status).toBe(403);
    expect((await t.request('GET', '/api/admin/logs', { token: member })).status).toBe(403);
  });

  it('officers do the day-to-day work: settings, logs, member list (offices are admin only)', async () => {
    expect((await t.request('POST', '/api/offices', { token: officer, body: office })).status).toBe(403);
    const created = await t.request('POST', '/api/offices', { cookie: admin, body: office });
    expect(created.status).toBe(201);
    const id = created.body.office.id;
    expect((await t.request('DELETE', `/api/offices/${id}`, { token: officer })).status).toBe(403);
    expect((await t.request('DELETE', `/api/offices/${id}`, { cookie: admin })).status).toBe(200);
    expect((await t.request('PUT', '/api/admin/settings/recruiting', { token: officer, body: { value: false } })).status).toBe(200);
    expect((await t.request('GET', '/api/admin/logs', { token: officer })).status).toBe(200);
    const users = await t.request('GET', '/api/admin/users', { token: officer });
    expect(users.status).toBe(200);
    for (const u of users.body.users) expect(u.passwordHash).toBeUndefined();
  });

  it('officers can suspend and reactivate regular members', async () => {
    const off = await t.request('PATCH', `/api/admin/users/${memberUser.id}`, { token: officer, body: { status: 'SUSPENDED' } });
    expect(off.status).toBe(200);
    expect((await t.request('GET', '/api/offices', { token: member })).status).toBe(401); // suspended
    const on = await t.request('PATCH', `/api/admin/users/${memberUser.id}`, { token: officer, body: { status: 'ACTIVE' } });
    expect(on.status).toBe(200);
    expect((await t.request('GET', '/api/offices', { token: member })).status).toBe(200);
  });

  it('only the admin can make someone an officer or change roles', async () => {
    const byOfficer = await t.request('PATCH', `/api/admin/users/${memberUser.id}`, { token: officer, body: { role: 'OFFICER' } });
    expect(byOfficer.status).toBe(403);
    expect(memberUser.role).toBe('MEMBER');

    const byAdmin = await t.request('PATCH', `/api/admin/users/${memberUser.id}`, { cookie: admin, body: { role: 'OFFICER' } });
    expect(byAdmin.status).toBe(200);
    expect(byAdmin.body.user.role).toBe('OFFICER');
    // role changes take effect immediately (no stale token claims)
    expect((await t.request('POST', '/api/forum/categories', { token: member, body: { name: 'Promoted Category' } })).status).toBe(201);
    await t.request('PATCH', `/api/admin/users/${memberUser.id}`, { cookie: admin, body: { role: 'MEMBER' } });
    expect((await t.request('POST', '/api/forum/categories', { token: member, body: { name: 'Demoted Category' } })).status).toBe(403);
  });

  it('only the admin can invite members', async () => {
    const body = { email: 'new@example.com', inGameName: 'Newbie' };
    expect((await t.request('POST', '/api/admin/users', { token: officer, body })).status).toBe(403);
    expect((await t.request('POST', '/api/admin/users', { cookie: admin, body })).status).toBe(201);
  });

  it('officers cannot manage other officers or the admin, and no one can be given the ADMIN role', async () => {
    const adminRow = await t.prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
    expect((await t.request('PATCH', `/api/admin/users/${adminRow.id}`, { token: officer, body: { status: 'SUSPENDED' } })).status).toBe(403);
    expect((await t.request('DELETE', `/api/admin/users/${adminRow.id}`, { token: officer })).status).toBe(403);
    expect((await t.request('PATCH', `/api/admin/users/${adminRow.id}`, { cookie: admin, body: { status: 'SUSPENDED' } })).status).toBe(400); // self
    const other = await t.createUser('OFFICER', 'officer2');
    expect((await t.request('PATCH', `/api/admin/users/${other.id}`, { token: officer, body: { status: 'SUSPENDED' } })).status).toBe(403);
    expect((await t.request('DELETE', `/api/admin/users/${other.id}`, { token: officer })).status).toBe(403);
    expect((await t.request('PATCH', `/api/admin/users/${memberUser.id}`, { cookie: admin, body: { role: 'ADMIN' } })).status).toBe(400);
    expect((await t.request('POST', '/api/admin/users', { cookie: admin, body: { email: 'x@example.com', inGameName: 'Xavier', role: 'ADMIN' } })).status).toBe(400);
    expect((await t.request('PATCH', `/api/admin/users/${other.id}`, { cookie: admin, body: { status: 'SUSPENDED' } })).status).toBe(200);
  });

  it('officers can remove regular members, never officers', async () => {
    const victim = await t.createUser('MEMBER', 'victim');
    expect((await t.request('DELETE', `/api/admin/users/${victim.id}`, { token: officer })).status).toBe(200);
    expect((await t.request('DELETE', `/api/admin/users/${officerUser.id}`, { token: officer })).status).toBe(400); // yourself
  });

  it('officers manage the document vault except admin-only documents', async () => {
    const doc = await t.prisma.document.create({
      data: { title: 'Secret', fileName: 's.txt', storedName: 's1', mimeType: 'text/plain', size: 1, visibleToRole: 'ADMIN' },
    });
    expect((await t.request('PATCH', `/api/documents/${doc.id}`, { token: officer, body: { title: 'Edited' } })).status).toBe(403);
    expect((await t.request('DELETE', `/api/documents/${doc.id}`, { token: officer })).status).toBe(403);
    const open = await t.prisma.document.create({
      data: { title: 'Open', fileName: 'o.txt', storedName: 'o1', mimeType: 'text/plain', size: 1, visibleToRole: 'MEMBER' },
    });
    expect((await t.request('PATCH', `/api/documents/${open.id}`, { token: officer, body: { title: 'Edited' } })).status).toBe(200);
    expect((await t.request('PATCH', `/api/documents/${open.id}`, { token: officer, body: { visibleToRole: 'ADMIN' } })).status).toBe(403);
  });

  it('officers can run forums and votes', async () => {
    expect((await t.request('POST', '/api/forum/categories', { token: officer, body: { name: 'Strategy' } })).status).toBe(201);
    expect((await t.request('POST', '/api/forum/categories', { token: member, body: { name: 'Nope' } })).status).toBe(403);
    const vote = await t.request('POST', '/api/votes', {
      token: officer,
      body: { title: 'New rule?', options: ['Yes', 'No'], endTime: new Date(Date.now() + 86400000).toISOString() },
    });
    expect(vote.status).toBe(201);
  });

  it('strips HTML from user-supplied text', async () => {
    const res = await t.request('POST', '/api/offices', {
      cookie: admin,
      body: { ...office, name: 'Clean <script>alert(1)</script>Office' },
    });
    expect(res.status).toBe(201);
    expect(res.body.office.name).not.toContain('<script>');
    expect(res.body.office.name).not.toContain('alert');
  });

  it('there are no calendar, reward or pledge endpoints any more', async () => {
    for (const path of ['/api/events', '/api/rewards', '/api/pledges']) {
      expect((await t.request('GET', path, { token: officer })).status).toBe(404);
    }
  });
});
