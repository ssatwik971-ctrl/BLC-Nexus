import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer } from './helpers.js';
import { officeWeeklyCost } from '../src/utils/maintenanceCost.js';

describe('office cash cost formula', () => {
  it('matches the in-game example: 100M power, headquarters level 2 = 30,000', () => {
    expect(officeWeeklyCost('Headquarters', 2, 100_000_000)).toBe(30_000);
  });

  it('a maxed headquarters is 30% of the 0.5% weekly total', () => {
    expect(officeWeeklyCost('Headquarters', 10, 100_000_000)).toBe(150_000);
  });

  it('uses each office share and maximum level', () => {
    const power = 265_940_000_000;
    expect(officeWeeklyCost('Headquarters', 10, power)).toBe(398_910_000);
    expect(officeWeeklyCost('Side Job Office', 5, power)).toBe(66_485_000);
    expect(officeWeeklyCost('Quality Office', 1, power)).toBe(18_615_800);
    expect(officeWeeklyCost('Energy Office', 1, power)).toBe(34_572_200);
    expect(officeWeeklyCost('Media Office', 2, power)).toBe(106_376_000);
    expect(officeWeeklyCost('R&D Office', 1, power)).toBe(110_808_333);
  });

  it('returns null for an unknown office name', () => {
    expect(officeWeeklyCost('Garden Shed', 3, 1e9)).toBeNull();
  });
});

describe('offices follow the coop power automatically', () => {
  let t;
  let member;
  let admin;
  beforeAll(async () => {
    t = await startTestServer();
    await t.createUser('MEMBER', 'member');
    member = await t.login('member@example.com');
    admin = await t.adminLogin();
  });
  afterAll(() => t.close());

  it('recalculates cash cost when a new power snapshot is added and ignores coin costs', async () => {
    expect((await t.request('POST', '/api/offices', { cookie: admin, body: { name: 'Headquarters', level: 10 } })).status).toBe(201);
    expect((await t.request('POST', '/api/audit/snapshots', { cookie: admin, body: { date: '2026-11-01', power: 100_000_000 } })).status).toBe(201);
    let res = await t.request('GET', '/api/offices', { token: member });
    expect(res.body.offices[0].weeklyMoneyCost).toBe(150_000);
    expect(res.body.power).toBe(100_000_000);

    await t.request('POST', '/api/audit/snapshots', { cookie: admin, body: { date: '2026-11-08', power: 200_000_000 } });
    res = await t.request('GET', '/api/offices', { token: member });
    expect(res.body.offices[0].weeklyMoneyCost).toBe(300_000);
    expect(res.body.totalWeeklyMoneyCost).toBe(300_000);
  });

  it('refuses a level above the office maximum', async () => {
    const res = await t.request('POST', '/api/offices', { cookie: admin, body: { name: 'R&D Office', level: 4 } });
    expect(res.status).toBe(400);
  });
});
