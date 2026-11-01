export const DAY = 24 * 60 * 60 * 1000;

/** UTC midnight of the given date. */
export function dayStart(input = new Date()) {
  const d = new Date(input);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Monday (UTC midnight) of the week containing the date. */
export function mondayOf(input = new Date()) {
  const start = dayStart(input);
  const dow = (start.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(start.getTime() - dow * DAY);
}

/** Parse "YYYY-MM-DD" (or ISO) into a valid Date, or null. */
export function parseDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}
