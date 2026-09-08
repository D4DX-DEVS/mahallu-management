/**
 * Data-type aware comparison for table sorting.
 *
 * A single `String(a) > String(b)` comparison put "10" before "2" and read a
 * date as the text "2024-03-01", so a numeric column sorted 1, 10, 2, 20 and a
 * date column sorted by the digits of its year-month-day string only when the
 * format happened to be ISO. Every sortable column in the product goes through
 * `compareValues`, which looks at the value rather than its rendering.
 */
import { SortDirection } from '@/types';

/** Blank cells always sink to the bottom, in both directions. */
function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]|$)/;
/** 12/03/2024, 12-03-2024 — the formats the API and the CSV importer emit. */
const SLASHED_DATE = /^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/;
/** A number, optionally with thousands separators, currency symbol or percent. */
const NUMERIC = /^[-+]?[₹$€£\s]*\d[\d,\s]*(\.\d+)?\s*%?$/;

function toDate(value: unknown): number | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (ISO_DATE.test(text)) {
    const parsed = Date.parse(text);
    return Number.isNaN(parsed) ? null : parsed;
  }
  if (SLASHED_DATE.test(text)) {
    // Day-first: the product is Indian and its dates are DD/MM/YYYY.
    const [day, month, year] = text.split(/[/-]/).map(Number);
    const parsed = new Date(year, month - 1, day).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!NUMERIC.test(text)) return null;
  const parsed = Number(text.replace(/[^0-9.+-]/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Collator rather than a raw `<`: `numeric` makes "MH-2" sort before "MH-10"
 * and "Item 9" before "Item 10", which is what an ID column needs, and the
 * base sensitivity keeps case and accents from splitting otherwise equal
 * labels. Malayalam sorts under the same collator as Latin.
 */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/**
 * Orders two cell values ascending. Blanks are reported as "after" whatever
 * they are compared with; `sortRows` keeps them last by short-circuiting
 * before the direction is applied.
 */
export function compareValues(a: unknown, b: unknown): number {
  if (isBlank(a) && isBlank(b)) return 0;
  if (isBlank(a)) return 1;
  if (isBlank(b)) return -1;

  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return Number(Boolean(a)) - Number(Boolean(b));
  }

  // A cell holding a collection sorts by how much it holds — the Members
  // column renders `members.length`, so it must sort on that too.
  if (Array.isArray(a) && Array.isArray(b)) return a.length - b.length;

  const dateA = toDate(a);
  const dateB = toDate(b);
  if (dateA !== null && dateB !== null) return dateA - dateB;

  const numberA = toNumber(a);
  const numberB = toNumber(b);
  if (numberA !== null && numberB !== null) return numberA - numberB;

  return collator.compare(stringify(a), stringify(b));
}

/** Objects reaching a sort are rendered by some label field; sort by the same. */
function stringify(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const label = record.name ?? record.label ?? record.title ?? record.value;
    if (typeof label === 'string' || typeof label === 'number') return String(label);
  }
  return String(value);
}

/**
 * Returns a new array — the caller's data is never mutated, so a list that is
 * also the source for export or bulk selection keeps its own order.
 *
 * The sort is stable: rows that tie stay in the order the API returned them.
 */
export function sortRows<T>(
  rows: T[],
  key: string,
  direction: SortDirection,
  accessor: (row: T, key: string) => unknown = (row, k) => (row as Record<string, unknown>)[k]
): T[] {
  const factor = direction === 'asc' ? 1 : -1;
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const a = accessor(left.row, key);
      const b = accessor(right.row, key);
      // Blanks stay at the bottom whichever way the column is pointed.
      const aBlank = isBlank(a);
      const bBlank = isBlank(b);
      if (aBlank || bBlank) {
        if (aBlank && bBlank) return left.index - right.index;
        return aBlank ? 1 : -1;
      }
      const result = compareValues(a, b);
      return result !== 0 ? result * factor : left.index - right.index;
    })
    .map((entry) => entry.row);
}

/**
 * The three-state cycle a header runs through: unsorted → ascending →
 * descending → unsorted. Returning to unsorted matters on server-backed lists,
 * where "no sort" is the API's own ordering and was otherwise unreachable once
 * a column had been clicked.
 */
export function nextSortState(
  current: { key: string; direction: SortDirection } | null | undefined,
  key: string
): { key: string; direction: SortDirection } | null {
  if (current?.key !== key) return { key, direction: 'asc' };
  if (current.direction === 'asc') return { key, direction: 'desc' };
  return null;
}
