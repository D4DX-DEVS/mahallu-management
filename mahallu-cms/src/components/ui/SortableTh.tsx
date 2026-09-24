import { ReactNode } from 'react';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { SortState } from '@/types';
import { cn } from '@/utils/cn';

export interface SortableThProps {
  /** The field on the row this column sorts by. */
  sortKey: string;
  sort: SortState | null;
  onSort: (key: string) => void;
  children: ReactNode;
  align?: 'left' | 'right' | 'center';
  className?: string;
  /** Hides the column below a breakpoint, e.g. 'hidden md:table-cell'. */
  responsiveClassName?: string;
}

const ALIGN = {
  left: 'text-left',
  right: 'text-right tabular-nums',
  center: 'text-center',
};

/**
 * A sortable header cell for a table written out by hand, matching the one the
 * shared Table renders: same three states, same glyph, same 13px heading, same
 * `aria-sort`. Pair it with `useSortableRows`.
 *
 * The control is a real button, so it is reachable by keyboard and carries a
 * focus ring; `title` says what the next click will do.
 */
export default function SortableTh({
  sortKey,
  sort,
  onSort,
  children,
  align = 'left',
  className,
  responsiveClassName,
}: SortableThProps) {
  const isSorted = sort?.key === sortKey;
  const direction = isSorted ? sort!.direction : null;
  const label = typeof children === 'string' ? children : 'this column';

  return (
    <th
      scope="col"
      aria-sort={isSorted ? (direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn(
        'px-3 py-2.5 text-label font-semibold text-muted-foreground',
        ALIGN[align],
        responsiveClassName,
        className
      )}
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        title={
          direction === 'asc'
            ? 'Sort ' + label + ' descending'
            : direction === 'desc'
              ? 'Stop sorting by ' + label
              : 'Sort ' + label + ' ascending'
        }
        className={cn(
          'inline-flex max-w-full items-center gap-1 rounded-sm transition-colors',
          'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          align === 'right' && 'flex-row-reverse',
          isSorted && 'text-foreground'
        )}
      >
        <span className="truncate">{children}</span>
        <span className="inline-flex flex-col items-center leading-none" aria-hidden="true">
          <FiChevronUp className={cn('-mb-1 h-3 w-3', direction === 'asc' ? 'opacity-100' : 'opacity-30')} />
          <FiChevronDown
            className={cn('-mt-1 h-3 w-3', direction === 'desc' ? 'opacity-100' : 'opacity-30')}
          />
        </span>
      </button>
    </th>
  );
}
