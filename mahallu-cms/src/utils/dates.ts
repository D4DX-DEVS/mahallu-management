/**
 * Calendar-date helpers. Date-only values travel as ISO strings 'YYYY-MM-DD' and are NEVER converted
 * through UTC: a Date built here is a local calendar date and is formatted with local getters, so a
 * value cannot shift by a day with the viewer's time zone. "Today" is the Asia/Kolkata calendar day.
 */

export const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const WEEKDAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const WEEKDAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

export interface YMD {
  y: number;
  m: number; // 1-12
  d: number;
}

export const daysInMonth = (y: number, m: number) => new Date(y, m, 0).getDate();

/** True when y-m-d is a real calendar date (year 1000-9999). */
export const isRealDate = (y: number, m: number, d: number) =>
  Number.isInteger(y) && y >= 1000 && y <= 9999 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);

/** Splits 'YYYY-MM-DD' (or an ISO datetime: only its date part is used) into numbers, or null. */
export const splitISO = (s: unknown): YMD | null => {
  if (typeof s !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:$|[T\s])/.exec(s.trim());
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  return isRealDate(y, mo, d) ? { y, m: mo, d } : null;
};

/** 'YYYY-MM-DD' (or ISO datetime) -> local Date at 00:00, or null when invalid. */
export const parseISODate = (s: unknown): Date | null => {
  const p = splitISO(s);
  if (!p) return null;
  const dt = new Date(2000, 0, 1);
  dt.setFullYear(p.y, p.m - 1, p.d);
  dt.setHours(0, 0, 0, 0);
  return dt;
};

export const ymdToISO = (y: number, m: number, d: number) => `${pad(y, 4)}-${pad(m)}-${pad(d)}`;

/** Local Date -> 'YYYY-MM-DD' using local getters (never toISOString). */
export const formatISODate = (d: Date) => ymdToISO(d.getFullYear(), d.getMonth() + 1, d.getDate());

/** Normalises 'YYYY-MM-DD' or ISO datetime to its date part; '' when not a date. */
export const normalizeISODate = (s: unknown): string => {
  const p = splitISO(s);
  return p ? ymdToISO(p.y, p.m, p.d) : '';
};

/** 'YYYY-MM-DD' -> 'dd/MM/yyyy' ('' when invalid). */
export const formatDisplay = (s: unknown): string => {
  const p = splitISO(s);
  return p ? `${pad(p.d)}/${pad(p.m)}/${pad(p.y, 4)}` : '';
};

/** 'YYYY-MM-DD' -> '12 Oct 2026'. */
export const formatDisplayLong = (s: unknown): string => {
  const p = splitISO(s);
  return p ? `${p.d} ${MONTHS_SHORT[p.m - 1]} ${p.y}` : '';
};

/** Today's calendar date in Asia/Kolkata as 'YYYY-MM-DD' (independent of the browser's time zone). */
export const todayISO = (): string => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const g = (t: string) => parts.find((p) => p.type === t)?.value || '';
  return `${g('year')}-${g('month')}-${g('day')}`;
};

/** Adds days to an ISO date using calendar arithmetic (no UTC conversion). */
export const addDaysISO = (s: string, n: number): string => {
  const d = parseISODate(s) ?? new Date();
  d.setDate(d.getDate() + n);
  return formatISODate(d);
};

/** Adds months, clamping the day to the target month's length (31 Jan + 1 month = 28/29 Feb). */
export const addMonthsISO = (s: string, n: number): string => {
  const p = splitISO(s) ?? splitISO(todayISO())!;
  const total = p.y * 12 + (p.m - 1) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return ymdToISO(y, m, Math.min(p.d, daysInMonth(y, m)));
};

/** First day of the current month (Asia/Kolkata), optionally `monthsBack` months earlier. Report-page default start dates. */
export const monthStartISO = (monthsBack = 0, today = todayISO()): string => addMonthsISO(`${today.slice(0, 8)}01`, -monthsBack);

/** 1 January of the current year (Asia/Kolkata). */
export const yearStartISO = (today = todayISO()): string => `${today.slice(0, 4)}-01-01`;

/** 0 = Sunday … 6 = Saturday for an ISO date. */
export const weekdayOf = (s: string): number => (parseISODate(s) ?? new Date()).getDay();

export const compareISO = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

const MONTH_LOOKUP = (name: string): number => {
  const n = name.toLowerCase() === 'sept' ? 'sep' : name.toLowerCase();
  if (n.length < 3) return 0;
  return MONTHS_LONG.findIndex((m) => m.toLowerCase().startsWith(n)) + 1;
};

/**
 * Parses typed text into 'YYYY-MM-DD'. Accepts 12/10/2026, 12-10-2026, 12.10.2026, 12102026,
 * '12 oct 2026', '12 October 2026' and a pasted ISO 'YYYY-MM-DD'. Returns null when it is not a real date.
 */
export const parseDateText = (text: string): string | null => {
  const t = text.trim();
  if (!t) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) return isRealDate(+m[1], +m[2], +m[3]) ? ymdToISO(+m[1], +m[2], +m[3]) : null;
  m = /^(\d{1,2})[/\-.\s](\d{1,2})[/\-.\s](\d{4})$/.exec(t) || /^(\d{2})(\d{2})(\d{4})$/.exec(t);
  if (m) return isRealDate(+m[3], +m[2], +m[1]) ? ymdToISO(+m[3], +m[2], +m[1]) : null;
  m = /^(\d{1,2})[/\-.\s]*([A-Za-z]{3,9})\.?[/\-.\s,]*(\d{4})$/.exec(t);
  if (m) {
    const mo = MONTH_LOOKUP(m[2]);
    return mo && isRealDate(+m[3], mo, +m[1]) ? ymdToISO(+m[3], mo, +m[1]) : null;
  }
  return null;
};

/** Parses typed month text ('10/2026', '2026-10', 'oct 2026') into 'YYYY-MM'. */
export const parseMonthText = (text: string): string | null => {
  const t = text.trim();
  let m = /^(\d{4})-(\d{1,2})$/.exec(t);
  if (m) return +m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1000 ? `${m[1]}-${pad(+m[2])}` : null;
  m = /^(\d{1,2})[/\-.\s](\d{4})$/.exec(t) || /^(\d{2})(\d{4})$/.exec(t);
  if (m) return +m[1] >= 1 && +m[1] <= 12 && +m[2] >= 1000 ? `${m[2]}-${pad(+m[1])}` : null;
  m = /^([A-Za-z]{3,9})\.?[/\-.\s,]*(\d{4})$/.exec(t);
  if (m) {
    const mo = MONTH_LOOKUP(m[1]);
    return mo ? `${m[2]}-${pad(mo)}` : null;
  }
  return null;
};

export const normalizeMonth = (s: unknown): string => {
  const m = typeof s === 'string' ? /^(\d{4})-(\d{2})/.exec(s.trim()) : null;
  return m && +m[2] >= 1 && +m[2] <= 12 ? `${m[1]}-${m[2]}` : '';
};
export const formatMonthDisplay = (s: unknown): string => {
  const n = normalizeMonth(s);
  return n ? `${MONTHS_SHORT[+n.slice(5) - 1]} ${n.slice(0, 4)}` : '';
};

export const normalizeTime = (s: unknown): string => {
  const m = typeof s === 'string' ? /^(\d{1,2}):(\d{2})/.exec(s.trim()) : null;
  return m && +m[1] <= 23 && +m[2] <= 59 ? `${pad(+m[1])}:${m[2]}` : '';
};
export const parseTimeText = (text: string): string | null => {
  const t = text.trim();
  const m = /^(\d{1,2})[:.h\s]?(\d{2})$/.exec(t) || /^(\d{1,2})$/.exec(t);
  if (!m) return null;
  const h = +m[1], mi = m[2] ? +m[2] : 0;
  return h <= 23 && mi <= 59 ? `${pad(h)}:${pad(mi)}` : null;
};

/** 'YYYY-MM-DDTHH:mm' (datetime-local) helpers. */
export const normalizeDateTime = (s: unknown): string => {
  const m = typeof s === 'string' ? /^(\d{4}-\d{2}-\d{2})[T\s](\d{1,2}:\d{2})/.exec(s.trim()) : null;
  if (!m) return '';
  const d = normalizeISODate(m[1]);
  const t = normalizeTime(m[2]);
  return d && t ? `${d}T${t}` : '';
};

/** Financial-year (Apr-Mar) start for the given ISO date. */
export const financialYearStart = (s: string): string => {
  const p = splitISO(s) ?? splitISO(todayISO())!;
  return ymdToISO(p.m >= 4 ? p.y : p.y - 1, 4, 1);
};
export const financialYearEnd = (s: string): string => {
  const p = splitISO(s) ?? splitISO(todayISO())!;
  return ymdToISO(p.m >= 4 ? p.y + 1 : p.y, 3, 31);
};

export type RangePresetKey = 'today' | 'yesterday' | 'last7' | 'thisMonth' | 'lastMonth' | 'thisFY';
export const RANGE_PRESETS: { key: RangePresetKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last7', label: 'Last 7 days' },
  { key: 'thisMonth', label: 'This month' },
  { key: 'lastMonth', label: 'Last month' },
  { key: 'thisFY', label: 'This financial year' },
];

export const rangeForPreset = (key: RangePresetKey, today = todayISO()): { from: string; to: string } => {
  const p = splitISO(today)!;
  switch (key) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = addDaysISO(today, -1);
      return { from: y, to: y };
    }
    case 'last7':
      return { from: addDaysISO(today, -6), to: today };
    case 'thisMonth':
      return { from: ymdToISO(p.y, p.m, 1), to: ymdToISO(p.y, p.m, daysInMonth(p.y, p.m)) };
    case 'lastMonth': {
      const prev = addMonthsISO(ymdToISO(p.y, p.m, 1), -1);
      const q = splitISO(prev)!;
      return { from: prev, to: ymdToISO(q.y, q.m, daysInMonth(q.y, q.m)) };
    }
    case 'thisFY':
      return { from: financialYearStart(today), to: financialYearEnd(today) };
  }
};
