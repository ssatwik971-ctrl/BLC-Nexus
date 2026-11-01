// Seed script: admin user, offices, forum categories, rewards, wiki pages, sample leaderboard.
// Run with: npm run db:seed   (idempotent — safe to run more than once)
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ADMIN_EMAIL = (process.env.SEED_ADMIN_EMAIL || 'admin@blcnexus.local').toLowerCase();
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'ChangeMe!2026';
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || 'BLC Leader';

const offices = [
  { name: 'HQ', description: 'Cooperative headquarters. Unlocks and boosts every other office.', level: 1, weeklyMoneyCost: 1000000, weeklyCoinCost: 0, sortOrder: 1 },
  { name: 'Sidejob', description: 'Extra jobs for cooperative members.', level: 1, weeklyMoneyCost: 500000, weeklyCoinCost: 0, sortOrder: 2 },
  { name: 'Quality', description: 'Quality boosts for production.', level: 1, weeklyMoneyCost: 500000, weeklyCoinCost: 0, sortOrder: 3 },
  { name: 'Energy', description: 'Energy supply and job energy.', level: 1, weeklyMoneyCost: 500000, weeklyCoinCost: 0, sortOrder: 4 },
  { name: 'Media', description: 'Media and marketing reach.', level: 1, weeklyMoneyCost: 500000, weeklyCoinCost: 0, sortOrder: 5 },
  { name: 'R&D', description: 'Research and development teams.', level: 1, weeklyMoneyCost: 750000, weeklyCoinCost: 0, sortOrder: 6 },
];

const categories = [
  { name: 'General', description: 'Anything BLC related.', order: 1 },
  { name: 'Production Chains', description: 'Efficient production chains and setups.', order: 2 },
  { name: 'Market Trends', description: 'Prices, demand and timing.', order: 3 },
  { name: 'Office Strategy', description: 'Cooperative office levels and maintenance planning.', order: 4 },
];

const rewards = [
  { name: 'Extra Job Energy', description: 'Cooperative energy refill for jobs.', donationCost: 100, currency: 'coins', type: 'energy' },
  { name: 'Quality Cards', description: 'Quality boost cards for production.', donationCost: 150, currency: 'coins', type: 'quality' },
  { name: 'R&D Teams', description: 'Additional research team capacity.', donationCost: 300, currency: 'coins', type: 'research' },
];

const wiki = [
  {
    slug: 'getting-started',
    title: 'Getting Started in BLC',
    content:
      'Welcome to the Billionaires Club!\n\n1. Join the cooperative in-game using the BLC tag.\n2. Check the Maintenance page for your weekly office assignment.\n3. Pay your office maintenance before the deadline and mark it as paid.\n4. Pledge donations toward cooperative rewards.\n5. Introduce yourself in the General forum.\n\n(Placeholder content — officers can edit this page.)',
  },
  {
    slug: 'maintenance-guide',
    title: 'Office Maintenance Guide',
    content:
      'Every cooperative office has a weekly maintenance cost. Missing it risks penalties for the whole club.\n\n- Offices are assigned to members each week.\n- Mark your assignment as paid once done; an officer verifies it.\n- If you cannot pay, tell an officer early so it can be reassigned.\n\n(Placeholder content — update with real in-game numbers.)',
  },
];

const settings = {
  home: {
    headline: 'The Command Center of the Billionaires Club',
    intro:
      'BILLIONAIRES CLUB (BLC) is a Ticarium: Business Tycoon cooperative built for players who want to grow faster together — shared offices, shared strategy, shared wins.',
  },
  stats: { power: 0, rank: null, officeLevels: 'All offices at level 1', note: 'Placeholder stats — update from Admin → Site.' },
  recruiting: true,
};

async function main() {
  await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      inGameName: ADMIN_NAME,
      role: 'ADMIN',
      status: 'ACTIVE',
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12),
      mustChangePassword: true,
    },
  });

  for (const o of offices) await prisma.office.upsert({ where: { name: o.name }, update: {}, create: o });
  for (const c of categories) await prisma.forumCategory.upsert({ where: { name: c.name }, update: {}, create: c });
  for (const w of wiki) await prisma.wikiPage.upsert({ where: { slug: w.slug }, update: {}, create: w });
  for (const [key, value] of Object.entries(settings)) {
    await prisma.siteSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  if ((await prisma.rewardItem.count()) === 0) await prisma.rewardItem.createMany({ data: rewards });

  if ((await prisma.leaderboardEntry.count()) === 0) {
    await prisma.leaderboardEntry.createMany({
      data: [
        { kind: 'ACTIVITY', name: 'Sample Member A', score: 980, rank: 1 },
        { kind: 'ACTIVITY', name: 'Sample Member B', score: 860, rank: 2 },
        { kind: 'ACTIVITY', name: 'Sample Member C', score: 750, rank: 3 },
        { kind: 'DONATION', name: 'Sample Member B', score: 1200, rank: 1 },
        { kind: 'DONATION', name: 'Sample Member A', score: 900, rank: 2 },
      ],
    });
  }

  if ((await prisma.auditSnapshot.count()) === 0) {
    const day = (n) => new Date(Date.UTC(2026, 9, 1 + n * 7));
    await prisma.auditSnapshot.createMany({
      data: [0, 1, 2, 3].map((n) => ({ date: day(n), power: 1000 + n * 250, rank: 40 - n * 3, memberCount: 10 + n, notes: n === 0 ? 'Placeholder data' : null })),
    });
  }

  console.log('Seed complete.');
  console.log(`Admin login: ${ADMIN_EMAIL}  /  ${ADMIN_PASSWORD}  (you must change this password after first login)`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
