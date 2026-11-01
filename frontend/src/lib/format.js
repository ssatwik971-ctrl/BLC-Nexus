export const fmtNumber = (n) => (n === null || n === undefined || n === '' ? '—' : Number(n).toLocaleString());

export const fmtDate = (v) =>
  v ? new Date(v).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '—';

export const fmtDateTime = (v) =>
  v ? new Date(v).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';

/** ISO string -> value for <input type="datetime-local"> in the viewer's timezone. */
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** datetime-local value -> ISO string (or null). */
export const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null);

export const toDateInput = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : '');

export const isoWeekStart = (date = new Date()) => {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
};

export const addDays = (isoDay, n) => {
  const d = new Date(`${isoDay}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const titleCase = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
