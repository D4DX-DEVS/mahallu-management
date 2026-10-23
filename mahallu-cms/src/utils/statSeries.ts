/**
 * Group loaded rows into consecutive calendar months (oldest first, max `months`) and
 * sum a value (or count rows). Returns [] when fewer than 2 distinct months are present,
 * so callers can skip the graphic instead of drawing a flat line.
 */
export function monthlySeries<T>(rows: T[], getDate: (r: T) => string | Date | undefined | null, getValue?: (r: T) => number, months = 6): number[] {
  const map = new Map<string, number>();
  rows.forEach((r) => {
    const raw = getDate(r);
    if (!raw) return;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    map.set(key, (map.get(key) ?? 0) + (getValue ? getValue(r) || 0 : 1));
  });
  const keys = [...map.keys()].sort().slice(-months);
  return keys.length >= 2 ? keys.map((k) => map.get(k) as number) : [];
}

export const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

import type { StatViz } from '@/components/ui/stat-viz';

/** Share of loaded rows matching a condition, as a ring. Undefined when there are no rows. */
export function shareViz(count: number, total: number, color?: string): StatViz | undefined {
  return total > 0 ? { type: 'ring', percent: pct(count, total), color } : undefined;
}

/** Waiting items as fading dots. Undefined when nothing is waiting. */
export function waitingViz(count: number, color?: string): StatViz | undefined {
  return count > 0 ? { type: 'dots', count, color } : undefined;
}

/** Map a grade label ("A", "Grade C") to a 1..5 level (A = 5). 0 when it is not a letter grade. */
export function gradeLevel(grade?: string | null): number {
  const m = (grade || '').toUpperCase().match(/\b([A-E])\b/);
  return m ? ({ A: 5, B: 4, C: 3, D: 2, E: 1 } as Record<string, number>)[m[1]] : 0;
}
