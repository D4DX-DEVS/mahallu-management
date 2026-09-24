import { useCallback, useMemo, useRef, useState } from 'react';
import { SortState } from '@/types';
import { nextSortState, sortRows } from '@/utils/sort';

/** Sorts a column by what the cell shows rather than by the field behind it. */
export type SortAccessors<T> = Record<string, (row: T) => unknown>;

/**
 * Sorting for a table written out by hand.
 *
 * Thirty-four pages render their own <table> rather than the shared Table —
 * financial reports with totals rows, detail-page sub-tables, list pages that
 * predate the component. They can have the same three-state, type-aware sort
 * without being rewritten: this hook holds the state and orders the rows,
 * `SortableTh` renders the control.
 *
 * Pass `accessors` for any column whose cell is derived. A Student column that
 * renders `memberName(row.memberId)` must sort on that name; sorting it on the
 * raw `memberId` puts the rows in an order nothing on screen explains.
 *
 * The returned array is a new one; the caller's data is never mutated, so the
 * same rows can still be exported or totalled in their original order.
 */
export function useSortableRows<T>(
  rows: T[],
  initialSort: SortState | null = null,
  accessors?: SortAccessors<T>
) {
  const [sort, setSort] = useState<SortState | null>(initialSort);

  /* Held in a ref: the map is written inline at the call site, so it is a new
   * object on every render and would re-sort the list on every render if it
   * were a dependency. The functions in it are pure lookups. */
  const accessorsRef = useRef(accessors);
  accessorsRef.current = accessors;

  const sorted = useMemo(() => {
    if (!sort) return rows;
    return sortRows(rows, sort.key, sort.direction, (row, key) => {
      const accessor = accessorsRef.current?.[key];
      return accessor ? accessor(row) : (row as Record<string, unknown>)[key];
    });
  }, [rows, sort]);

  /** unsorted -> ascending -> descending -> unsorted */
  const toggleSort = useCallback((key: string) => {
    setSort((current) => nextSortState(current, key));
  }, []);

  return { rows: sorted, sort, toggleSort, setSort };
}

export default useSortableRows;
