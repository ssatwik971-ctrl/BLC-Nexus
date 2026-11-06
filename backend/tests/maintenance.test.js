import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer } from './helpers.js';
import { mondayOf, DAY } from '../src/utils/dates.js';

let t;
let member;
let officer;
let adminCookie;
let memberUser;
let officerUser;
const iso = (d) => d.toISOString().slice(0, 10);
const thisWeek = iso(mondayOf());
const lastWeek = iso(new Date(mondayOf().getTime() - 7 * DAY));
const nextWeek = iso(new Date(mondayOf().getTime() + 7 * DAY));

beforeAll(async () => {
  t = await startTestServer();
  memberUser = await t.createUser('MEMBER', 'member');
  officerUser = await t.createUser('OFFICER', 'officer');
  member = await t.login('member@example.com');
  officer = await t.login('officer@example.com');
  adminCookie = await t.adminLogin();
});
afterAll(() => t.close());

describe('maintenance is no longer assigned', () => {
  it('has no assign or copy-week endpoints', async () => {
    const body = { officeId: 'x', userId: memberUser.id };
    expect((await t.request('POST', '/api/maintenance', { token: officer, body })).status).toBe(404);
    expect((await t.request('POST', '/api/maintenance/copy-week', { token: officer, body: { from: lastWeek, to: thisWeek } })).status).toBe(404);
  });
});

describe('weekly maintenance totals (admin only)', () => {
  it('only the admin can enter or change totals', async () => {
    const body = { weekStart: lastWeek, cash: 1000, coins: 10 };
    expect((await t.request('PUT', '/api/maintenance-expenses', { body })).status).toBe(401);
    expect((await t.request('PUT', '/api/maintenance-expenses', { token: member, body })).status).toBe(403);
    expect((await t.request('PUT', '/api/maintenance-expenses', { token: officer, body })).status).toBe(403);
    expect((await t.request('PUT', '/api/maintenance-expenses', { cookie: adminCookie, body })).status).toBe(200);
  });

  it('validates amounts and rejects future weeks', async () => {
    const put = (body) => t.request('PUT', '/api/maintenance-expenses', { cookie: adminCookie, body });
    expect((await put({ weekStart: lastWeek, cash: -1, coins: 0 })).status).toBe(400);
    expect((await put({ weekStart: lastWeek, cash: 5, coins: 1.5 })).status).toBe(400);
    expect((await put({ weekStart: nextWeek, cash: 5, coins: 1 })).status).toBe(400);
  });

  it('saving the same week again replaces it instead of adding a second row', async () => {
    await t.request('PUT', '/api/maintenance-expenses', { cookie: adminCookie, body: { weekStart: lastWeek, cash: 2000, coins: 20 } });
    const list = await t.request('GET', '/api/maintenance-expenses', { token: member });
    expect(list.body.expenses).toHaveLength(1);
    expect(list.body.totals).toEqual({ cash: 2000, coins: 20 });
    expect(list.body.promptWeek).toBeNull(); // members are never asked
  });

  it('asks only the admin about an unrecorded week', async () => {
    const asAdmin = await t.request('GET', '/api/maintenance-expenses', { cookie: adminCookie });
    // last week is recorded; this week is only due on Sunday
    expect(asAdmin.body.promptWeek === null || asAdmin.body.promptWeek === thisWeek).toBe(true);
  });

  it('deducts the totals from the coop balance for cash and coins separately', async () => {
    await t.request('POST', '/api/donations', { token: officer, body: { userId: memberUser.id, type: 'CASH', amount: 5000 } });
    await t.request('POST', '/api/donations', { token: officer, body: { userId: memberUser.id, type: 'COINS', amount: 100 } });
    const cash = await t.request('GET', '/api/donations?type=CASH', { token: member });
    const coins = await t.request('GET', '/api/donations?type=COINS', { token: member });
    expect([cash.body.total, cash.body.spent, cash.body.balance]).toEqual([5000, 2000, 3000]);
    expect([coins.body.total, coins.body.spent, coins.body.balance]).toEqual([100, 20, 80]);
  });

  it('only the admin can delete a total, which restores the balance', async () => {
    const id = (await t.request('GET', '/api/maintenance-expenses', { token: member })).body.expenses[0].id;
    expect((await t.request('DELETE', `/api/maintenance-expenses/${id}`, { token: officer })).status).toBe(403);
    expect((await t.request('DELETE', `/api/maintenance-expenses/${id}`, { cookie: adminCookie })).status).toBe(200);
    expect((await t.request('GET', '/api/donations?type=CASH', { token: member })).body.balance).toBe(5000);
  });
});

describe('weekly donation status', () => {
  it('officers cannot mark themselves; the admin can mark anyone', async () => {
    const own = { userId: officerUser.id, met: true, weekStart: thisWeek };
    expect((await t.request('PUT', '/api/donation-status', { token: officer, body: own })).status).toBe(403);
    expect((await t.request('PUT', '/api/donation-status', { cookie: adminCookie, body: own })).status).toBe(200);
    await t.request('PUT', '/api/donation-status', { cookie: adminCookie, body: { ...own, met: false } });
  });

  it('lists the admin, officers and members for everyone', async () => {
    const res = await t.request('GET', `/api/donation-status?week=${thisWeek}`, { token: member });
    expect(res.status).toBe(200);
    expect(res.body.people.map((p) => p.role)).toEqual(['ADMIN', 'OFFICER', 'MEMBER']);
    expect(res.body.people.every((p) => p.met === false)).toBe(true);
  });

  it('members cannot change it; officers and the admin can', async () => {
    const body = { userId: memberUser.id, met: true, weekStart: thisWeek };
    expect((await t.request('PUT', '/api/donation-status', { token: member, body })).status).toBe(403);
    expect((await t.request('PUT', '/api/donation-status', { token: officer, body })).status).toBe(200);
    const asMember = await t.request('GET', `/api/donation-status?week=${thisWeek}`, { token: member });
    expect(asMember.body.people.find((p) => p.id === memberUser.id).met).toBe(true);
    expect(asMember.body.metCount).toBe(1);
    const flip = { userId: memberUser.id, met: false, weekStart: thisWeek };
    expect((await t.request('PUT', '/api/donation-status', { cookie: adminCookie, body: flip })).status).toBe(200);
    expect((await t.request('GET', `/api/donation-status?week=${thisWeek}`, { token: member })).body.metCount).toBe(0);
  });

  it('keeps each week separate and rejects future weeks and unknown players', async () => {
    await t.request('PUT', '/api/donation-status', { cookie: adminCookie, body: { userId: officerUser.id, met: true, weekStart: lastWeek } });
    expect((await t.request('GET', `/api/donation-status?week=${lastWeek}`, { token: member })).body.metCount).toBe(1);
    expect((await t.request('GET', `/api/donation-status?week=${thisWeek}`, { token: member })).body.metCount).toBe(0);
    expect((await t.request('PUT', '/api/donation-status', { token: officer, body: { userId: memberUser.id, met: true, weekStart: nextWeek } })).status).toBe(400);
    expect((await t.request('PUT', '/api/donation-status', { token: officer, body: { userId: 'nobody', met: true } })).status).toBe(404);
  });
});

describe('safety rules', () => {
  it('a member with donations cannot be deleted (the coop balance would change)', async () => {
    const del = await t.request('DELETE', `/api/admin/users/${memberUser.id}`, { token: officer });
    expect(del.status).toBe(409);
    const stillThere = await t.request('GET', '/api/donations?type=CASH', { token: member });
    expect(stillThere.body.total).toBe(5000);
  });

  it('a member without donations can still be deleted', async () => {
    const spare = await t.createUser('MEMBER', 'spare');
    expect((await t.request('DELETE', `/api/admin/users/${spare.id}`, { token: officer })).status).toBe(200);
  });

  it('upvoting a post that does not exist is a 404, not a server error', async () => {
    expect((await t.request('POST', '/api/forum/posts/nope/upvote', { token: member })).status).toBe(404);
  });

  it('draft votes are listed for officers without crashing and hidden from members', async () => {
    await t.prisma.vote.create({ data: { title: 'Draft vote', options: ['A', 'B'], status: 'DRAFT', endTime: new Date(Date.now() + DAY), startTime: new Date() } });
    const asMember = await t.request('GET', '/api/votes', { token: member });
    const asOfficer = await t.request('GET', '/api/votes', { token: officer });
    expect(asMember.status).toBe(200);
    expect(asMember.body.votes.some((v) => v.title === 'Draft vote')).toBe(false);
    expect(asOfficer.status).toBe(200);
    expect(asOfficer.body.votes.some((v) => v.title === 'Draft vote')).toBe(true);
  });

  it('only the admin can sign out all devices', async () => {
    expect((await t.request('POST', '/api/auth/admin-logout-all', { token: officer })).status).toBe(403);
    const cookie = await t.adminLogin();
    expect((await t.request('POST', '/api/auth/admin-logout-all', { cookie })).status).toBe(200);
    expect((await t.request('GET', '/api/auth/me', { cookie })).status).toBe(401);
  });
});
