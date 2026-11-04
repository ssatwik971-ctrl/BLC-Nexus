import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer } from './helpers.js';

let t;
let member;
let officer;
let other;
let memberUser;
let otherUser;

beforeAll(async () => {
  t = await startTestServer();
  memberUser = await t.createUser('MEMBER', 'member');
  otherUser = await t.createUser('MEMBER', 'other');
  await t.createUser('OFFICER', 'officer');
  member = await t.login('member@example.com');
  other = await t.login('other@example.com');
  officer = await t.login('officer@example.com');
});
afterAll(() => t.close());

describe('cash and coin donations', () => {
  it('officers record cash and coin donations; members cannot', async () => {
    const body = { userId: memberUser.id, type: 'CASH', amount: 2500000, note: 'Week 1' };
    expect((await t.request('POST', '/api/donations', { token: member, body })).status).toBe(403);
    expect((await t.request('POST', '/api/donations', { body })).status).toBe(401);
    expect((await t.request('POST', '/api/donations', { token: officer, body })).status).toBe(201);
    expect((await t.request('POST', '/api/donations', { token: officer, body: { userId: memberUser.id, type: 'COINS', amount: 150 } })).status).toBe(201);
    expect((await t.request('POST', '/api/donations', { token: officer, body: { userId: otherUser.id, type: 'COINS', amount: 400 } })).status).toBe(201);
  });

  it('validates the donation type, amount and member', async () => {
    const post = (body) => t.request('POST', '/api/donations', { token: officer, body });
    expect((await post({ userId: memberUser.id, type: 'GEMS', amount: 5 })).status).toBe(400);
    expect((await post({ userId: memberUser.id, type: 'CASH', amount: 0 })).status).toBe(400);
    expect((await post({ userId: memberUser.id, type: 'CASH', amount: -5 })).status).toBe(400);
    expect((await post({ userId: memberUser.id, type: 'COINS', amount: 10.5 })).status).toBe(400);
    expect((await post({ userId: 'nobody', type: 'CASH', amount: 5 })).status).toBe(404);
  });

  it('keeps cash and coins in separate sections with separate totals', async () => {
    const cash = await t.request('GET', '/api/donations?type=cash', { token: member });
    const coins = await t.request('GET', '/api/donations?type=coins', { token: member });
    expect(cash.status).toBe(200);
    expect(cash.body.total).toBe(2500000);
    expect(cash.body.mine).toBe(2500000);
    expect(cash.body.donations.every((d) => d.type === 'CASH')).toBe(true);
    expect(coins.body.total).toBe(550);
    expect(coins.body.mine).toBe(150);
    expect(coins.body.donations.every((d) => d.type === 'COINS')).toBe(true);
    expect((await t.request('GET', '/api/donations', { token: member })).status).toBe(400);
  });

  it('has a separate top-donor board for each type', async () => {
    const coins = await t.request('GET', '/api/donations/leaderboard?type=COINS', { token: other });
    expect(coins.body.leaderboard.map((r) => [r.rank, r.name, r.total])).toEqual([
      [1, 'other', 400],
      [2, 'member', 150],
    ]);
    const cash = await t.request('GET', '/api/donations/leaderboard?type=CASH', { token: other });
    expect(cash.body.leaderboard.map((r) => r.name)).toEqual(['member']);
  });

  it('shows each member their own cash and coin totals on their profile', async () => {
    const me = await t.request('GET', '/api/users/me', { token: member });
    expect(me.body.contributions.totalCash).toBe(2500000);
    expect(me.body.contributions.totalCoins).toBe(150);
    expect(me.body.contributions.donations).toHaveLength(2);
    const notes = await t.request('GET', '/api/notifications', { token: member });
    expect(notes.body.notifications.some((n) => /cash donation/.test(n.message))).toBe(true);
  });

  it('officers can delete a mistaken entry; members cannot', async () => {
    const list = await t.request('GET', '/api/donations?type=COINS', { token: officer });
    const id = list.body.donations.find((d) => d.userId === otherUser.id).id;
    expect((await t.request('DELETE', `/api/donations/${id}`, { token: member })).status).toBe(403);
    expect((await t.request('DELETE', `/api/donations/${id}`, { token: officer })).status).toBe(200);
    expect((await t.request('GET', '/api/donations?type=COINS', { token: member })).body.total).toBe(150);
  });
});
