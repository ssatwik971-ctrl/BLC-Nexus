/**
 * Weekly cash cost of the coop's headquarters and offices.
 *
 * Total weekly cost is 0.5% of the coop's power. Each office takes a share of that total
 * and its cost grows with its level:
 *   cost = level * (power * 0.005 * share) / maxLevel
 * Coin costs are not calculated here.
 */
export const WEEKLY_RATE = 0.005;

// Keys are the office names with spaces, dots and case removed.
export const OFFICE_RULES = {
  headquarters: { share: 0.3, maxLevel: 10 },
  sidejoboffice: { share: 0.05, maxLevel: 5 },
  qualityoffice: { share: 0.07, maxLevel: 5 },
  energyoffice: { share: 0.13, maxLevel: 5 },
  mediaoffice: { share: 0.2, maxLevel: 5 },
  rdoffice: { share: 0.25, maxLevel: 3 },
};

export const OFFICE_NAMES = ['Headquarters', 'Side Job Office', 'Quality Office', 'Energy Office', 'Media Office', 'R&D Office'];

const keyOf = (name) => String(name || '').toLowerCase().replace(/&/g, '').replace(/[^a-z0-9]/g, '');

export function officeRule(name) {
  return OFFICE_RULES[keyOf(name)] || null;
}

/** Cash cost for one office, or null when the office name has no rule. */
export function officeWeeklyCost(name, level, power) {
  const rule = officeRule(name);
  if (!rule) return null;
  const lv = Math.max(0, Number(level) || 0);
  return Math.round((lv * (Number(power) || 0) * WEEKLY_RATE * rule.share) / rule.maxLevel);
}

/** Latest recorded coop power (0 when no snapshot exists yet). */
export async function currentPower(prisma) {
  const latest = await prisma.auditSnapshot.findMany({ orderBy: { date: 'desc' }, take: 1 });
  return latest[0] ? { power: latest[0].power, date: latest[0].date } : { power: 0, date: null };
}

/** Offices with their cash cost recalculated from the given power. Known offices ignore the stored cost. */
export function withCosts(offices, power) {
  return offices.map((o) => {
    const rule = officeRule(o.name);
    const cost = officeWeeklyCost(o.name, o.level, power);
    return { ...o, weeklyMoneyCost: cost ?? o.weeklyMoneyCost, maxLevel: rule?.maxLevel ?? null, calculated: cost !== null };
  });
}
