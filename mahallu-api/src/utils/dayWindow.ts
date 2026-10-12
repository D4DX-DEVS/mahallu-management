/**
 * A "day" for cash closing is the mahallu's local calendar day (default IST, UTC+5:30;
 * override with CASH_DAY_TZ_OFFSET_MIN). Payment dates stored as UTC midnight or as
 * local midnight both fall inside the same local-day window.
 */
const offsetMin = (): number => {
  const n = parseInt(process.env.CASH_DAY_TZ_OFFSET_MIN || '330', 10);
  return Number.isFinite(n) ? n : 330;
};

export const isDateKey = (s: any): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s);

export const todayKey = (now: Date = new Date()): string =>
  new Date(now.getTime() + offsetMin() * 60000).toISOString().slice(0, 10);

export const dayWindow = (dateKey: string): { start: Date; end: Date } => {
  const [y, m, d] = dateKey.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d) - offsetMin() * 60000);
  return { start, end: new Date(start.getTime() + 24 * 3600 * 1000) };
};

/**
 * Report range bounds. A date-only string (2026-10-12) means the whole local (IST) calendar day:
 * start = 00:00 local, end = 23:59:59.999 local. Full timestamps are used as given.
 */
export const rangeStart = (s: string): Date => (isDateKey(s) ? dayWindow(s).start : new Date(s));
export const rangeEnd = (s: string): Date =>
  isDateKey(s) ? new Date(dayWindow(s).end.getTime() - 1) : new Date(s);
