import { Varisangya } from '@/services/collectibleService';

/** Date-range filtering for the varisangya list, kept out of the page file. */
const parseYMD = (s: string): { y: number; m: number; d: number } | null => {
  const parts = s.trim().split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => isNaN(n))) return null;
  const [a, b, c] = parts;
  if (a > 31 || a >= 1000) return { y: a, m: b, d: c };
  if (c > 31 || c >= 1000) return { y: c, m: b, d: a };
  return null;
};

export const filterByDateRange = (rows: Varisangya[], from?: string, to?: string): Varisangya[] => {
  if (!from && !to) return rows;
  const fromParsed = from ? parseYMD(from) : null;
  const toParsed = to ? parseYMD(to) : null;
  if (!fromParsed && !toParsed) return rows;
  const startMs = fromParsed
    ? Date.UTC(fromParsed.y, fromParsed.m - 1, fromParsed.d, 0, 0, 0, 0)
    : 0;
  const endMs = toParsed
    ? Date.UTC(toParsed.y, toParsed.m - 1, toParsed.d, 23, 59, 59, 999)
    : Number.MAX_SAFE_INTEGER;
  return rows.filter((row) => {
    const t = row.paymentDate ? new Date(row.paymentDate).getTime() : 0;
    return t >= startMs && t <= endMs;
  });
};
