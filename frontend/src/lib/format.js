const SUFFIXES = [[1e12, 'T'], [1e9, 'B'], [1e6, 'M'], [1e3, 'K']];

/** 1000000 -> 1M, 265940000000 -> 265.94B, 1500 -> 1.5K. Numbers under 1000 are shown in full. */
export function fmtCompact(n, digits = 2) {
  if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return '—';
  const v = Number(n);
  const abs = Math.abs(v);
  const i = SUFFIXES.findIndex(([size]) => abs >= size);
  if (i === -1) return String(Number(v.toFixed(digits)));
  let [size, suffix] = SUFFIXES[i];
  let rounded = Number((v / size).toFixed(digits));
  // Rounding can push 999,999 up to 1000K, so show it as 1M instead.
  if (Math.abs(rounded) >= 1000 && i > 0) {
    [size, suffix] = SUFFIXES[i - 1];
    rounded = Number((v / size).toFixed(digits));
  }
  return `${rounded}${suffix}`;
}

/** Exact number with thousands separators (used in tooltips). */
export const fmtFull = (n) => (n === null || n === undefined || n === '' ? '—' : Number(n).toLocaleString());

export const fmtNumber = (n) => fmtCompact(n);

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
