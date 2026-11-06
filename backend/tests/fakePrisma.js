// Minimal in-memory stand-in for PrismaClient, covering only what the tested flows use.
// It ignores include/select/orderBy and supports simple where clauses
// (equality, in, gt/gte/lt/lte, OR, contains). Good enough for auth/RBAC/application tests.
import crypto from 'node:crypto';

const isObj = (v) => v && typeof v === 'object' && !(v instanceof Date) && !Array.isArray(v);

function matchField(value, cond) {
  if (isObj(cond)) {
    if ('in' in cond) return cond.in.includes(value);
    if ('equals' in cond) return value === cond.equals;
    if ('contains' in cond) return String(value ?? '').toLowerCase().includes(String(cond.contains).toLowerCase());
    if ('gt' in cond && !(value > cond.gt)) return false;
    if ('gte' in cond && !(value >= cond.gte)) return false;
    if ('lt' in cond && !(value < cond.lt)) return false;
    if ('lte' in cond && !(value <= cond.lte)) return false;
    return true;
  }
  if (value instanceof Date && cond instanceof Date) return value.getTime() === cond.getTime();
  return value === cond;
}

function matches(row, where = {}) {
  return Object.entries(where).every(([key, cond]) => {
    if (key === 'OR') return cond.some((w) => matches(row, w));
    if (key === 'AND') return cond.every((w) => matches(row, w));
    return matchField(row[key], cond);
  });
}

function table(defaults = {}) {
  const rows = [];
  const notFound = () => Object.assign(new Error('Record not found'), { code: 'P2025' });
  const t = {
    rows,
    async findUnique({ where }) {
      return rows.find((r) => matches(r, where)) || null;
    },
    async findFirst({ where } = {}) {
      return rows.find((r) => matches(r, where)) || null;
    },
    async findMany({ where, take } = {}) {
      const found = rows.filter((r) => matches(r, where));
      return take ? found.slice(0, take) : found;
    },
    async count({ where } = {}) {
      return rows.filter((r) => matches(r, where)).length;
    },
    async create({ data }) {
      const row = { id: crypto.randomUUID(), createdAt: new Date(), ...defaults, ...data };
      rows.push(row);
      return row;
    },
    async createMany({ data }) {
      for (const d of data) await t.create({ data: d });
      return { count: data.length };
    },
    async update({ where, data }) {
      const row = rows.find((r) => matches(r, where));
      if (!row) throw notFound();
      Object.assign(row, data, { updatedAt: new Date() });
      return row;
    },
    async updateMany({ where, data }) {
      const found = rows.filter((r) => matches(r, where));
      found.forEach((r) => Object.assign(r, data));
      return { count: found.length };
    },
    async upsert({ where, update, create }) {
      const row = rows.find((r) => matches(r, where));
      return row ? t.update({ where, data: update }) : t.create({ data: create });
    },
    async delete({ where }) {
      const i = rows.findIndex((r) => matches(r, where));
      if (i < 0) throw notFound();
      return rows.splice(i, 1)[0];
    },
    async groupBy({ by, where, _sum, orderBy, take }) {
      const groups = new Map();
      for (const row of rows.filter((r) => matches(r, where))) {
        const key = by.map((k) => row[k]).join('|');
        if (!groups.has(key)) groups.set(key, { ...Object.fromEntries(by.map((k) => [k, row[k]])), _sum: {} });
        const g = groups.get(key);
        for (const field of Object.keys(_sum || {})) g._sum[field] = (g._sum[field] || 0) + (row[field] || 0);
      }
      let out = [...groups.values()];
      const sortField = orderBy?._sum && Object.keys(orderBy._sum)[0];
      if (sortField) out.sort((a, b) => (orderBy._sum[sortField] === 'desc' ? -1 : 1) * (a._sum[sortField] - b._sum[sortField]));
      return take ? out.slice(0, take) : out;
    },
    async deleteMany({ where } = {}) {
      const keep = rows.filter((r) => !matches(r, where));
      const count = rows.length - keep.length;
      rows.splice(0, rows.length, ...keep);
      return { count };
    },
  };
  return t;
}

export function createFakePrisma() {
  const prisma = {
    user: table({ status: 'INVITED', role: 'MEMBER', hiddenFields: [], notifyEmail: true }),
    application: table({ status: 'PENDING' }),
    office: table({ level: 1, weeklyMoneyCost: 0, weeklyCoinCost: 0, sortOrder: 0 }),
    siteSetting: table(),
    auditLog: table(),
    notification: table({ read: false }),
    leaderboardEntry: table(),
    donation: table(),
    maintenanceExpense: table({ cash: 0, coins: 0 }),
    weeklyDonationStatus: table({ met: false }),
    adminSession: table(),
    forumCategory: table({ order: 0 }),
    document: table({ visibleToRole: 'MEMBER' }),
    vote: table({ status: 'OPEN', eligibleRole: 'MEMBER' }),
    voteRecord: table(),
    maintenanceAssignment: table({ status: 'UNPAID' }),
    forumPost: table(),
    async $transaction(ops) {
      return Promise.all(ops);
    },
  };
  return prisma;
}
