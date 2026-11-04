// Seed script: offices, forum categories, starter wiki pages and site settings.
// It creates NO accounts: the admin signs in with ADMIN_EMAIL + ADMIN_PIN and members are invited.
// Run with: npm run db:seed   (idempotent — safe to run more than once)
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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

const wiki = [
  {
    slug: 'getting-started',
    title: 'Getting Started in BLC',
    content:
      'Welcome to the Billionaires Club!\n\n1. Join the cooperative in-game using the BLC tag.\n2. Check the Maintenance page for your weekly office assignment.\n3. Pay your office maintenance before the deadline and mark it as paid.\n4. Donate cash or coins to the cooperative when you can (officers record it).\n5. Introduce yourself in the General forum.\n\n(Officers can edit this page.)',
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
  for (const o of offices) await prisma.office.upsert({ where: { name: o.name }, update: {}, create: o });
  for (const c of categories) await prisma.forumCategory.upsert({ where: { name: c.name }, update: {}, create: c });
  for (const w of wiki) await prisma.wikiPage.upsert({ where: { slug: w.slug }, update: {}, create: w });
  for (const [key, value] of Object.entries(settings)) {
    await prisma.siteSetting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  console.log('Seed complete.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
