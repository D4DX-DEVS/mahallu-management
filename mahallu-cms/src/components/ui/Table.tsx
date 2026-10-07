import { KeyboardEvent, MouseEvent, ReactNode, useId, useMemo, useState } from 'react';
import { FiChevronUp, FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { TableColumn, SortState } from '@/types';
import { cn } from '@/utils/cn';
import { nextSortState, sortRows, valueKind } from '@/utils/sort';
import Skeleton, { TableSkeleton } from './Skeleton';
import EmptyState, { EmptyStateVariant } from './EmptyState';

/**
 * Three states, one glyph. Unsorted shows both chevrons at low contrast so the
 * column reads as sortable before it is touched; the active direction is the
 * only one at full strength. Decorative - `aria-sort` on the <th> is what a
 * screen reader announces.
 */
function SortIndicator({ direction }: { direction: 'asc' | 'desc' | null }) {
  return (
    <span className="inline-flex flex-shrink-0 flex-col items-center gap-px leading-none" aria-hidden="true">
      <FiChevronUp className={cn('h-3 w-3', direction === 'asc' ? 'opacity-100' : 'opacity-60')} />
      <FiChevronDown className={cn('h-3 w-3', direction === 'desc' ? 'opacity-100' : 'opacity-60')} />
    </span>
  );
}

export interface TableProps<T = any> {
  columns: TableColumn<T>[];
  data: T[];
  isLoading?: boolean;

  /** Stable row identity. Falls back to `id`, then to the array index. */
  rowKey?: (row: T, index: number) => string;

  onRowClick?: (row: T) => void;

  /* ---- Sorting ---------------------------------------------------------
   * Table sorts the rows it was handed, type-aware, in three states:
   * unsorted -> ascending -> descending -> unsorted.
   *
   * It used to only report intent and leave the ordering to the caller, but
   * the API sorts on two fields across fifty-five controllers, so on all but
   * two lists `sortable: true` painted a glyph that did nothing. Sorting the
   * rows it received is the ordering the user actually sees, and it stays
   * correct alongside search and filters because those run before the rows
   * arrive.
   *
   * `sort` / `onSortChange` still work, for a page that also wants to tell the
   * API: the two compose, because ordering rows that are already in that order
   * changes nothing. `onSortChange` is handed null on the third click. */
  sort?: SortState | null;
  onSortChange?: (sort: SortState | null) => void;

  /**
   * Turns every column into a sort control unless the column opts out with
   * `sortable: false`. Set false for a table whose row order carries meaning -
   * a ledger, a ranked list, a form's own rows.
   */
  sortable?: boolean;

  /**
   * The caller has already ordered `data` and Table must not reorder it. Only
   * for a list the API genuinely sorts across every page.
   */
  serverSorted?: boolean;

  /* ---- Selection and bulk actions ------------------------------------- */
  selectable?: boolean;
  selectedKeys?: string[];
  onSelectionChange?: (keys: string[]) => void;
  /** Rendered above the table when at least one row is selected. */
  bulkActions?: ReactNode;

  /* ---- States ---------------------------------------------------------- */
  /** Plural entity name used to write the empty-state copy, e.g. "families". */
  entity?: string;
  /** `no-results` when filters are active, so the copy and action differ. */
  emptyVariant?: EmptyStateVariant;
  emptyAction?: { label: string; onClick: () => void };
  /** @deprecated Pass `entity` + `emptyVariant` instead. */
  emptyMessage?: string;

  className?: string;
  /** Minimum table width so columns scroll instead of crushing on phones. */
  minWidth?: string;

  /**
   * Locks every column to its declared `width` (`table-layout: fixed`) and
   * clips any cell that overruns to an ellipsis, with the full text on hover.
   *
   * Without it a column is only as wide as its widest cell demands, so one
   * long value - a family head with three names - stretches its column and
   * squeezes every other one for the whole table.
   *
   * Only for a table whose columns all declare a `width`; a column without one
   * is handed whatever space is left.
   */
  fixedLayout?: boolean;

  /** Tints alternate rows, so the eye tracks a row across a wide table. */
  striped?: boolean;

  /* ---- Removed ---------------------------------------------------------
   * Table used to ship its own CSV/JSON/PDF bar that duplicated TableToolbar's
   * export menu — pages that used both showed export twice. Export now lives
   * in TableToolbar only. These props are accepted and ignored so existing
   * call sites keep compiling. */
  /** @deprecated Export lives in TableToolbar. */
  exportFilename?: string;
  /** @deprecated Export lives in TableToolbar. */
  exportTitle?: string;
  /** @deprecated Export lives in TableToolbar. */
  showExport?: boolean;
  /** @deprecated Export lives in TableToolbar. */
  onExportAll?: () => Promise<T[]>;
}

const PRIORITY_CLASS: Record<NonNullable<TableColumn['priority']>, string> = {
  primary: '',
  secondary: 'hidden md:table-cell',
  tertiary: 'hidden lg:table-cell',
};

/* Aligns with design tokens: label 13 for headings/meta, sm 14 for body. Central fix for literal 15/14 drift. */
const HEAD_FONT = { fontSize: '0.8125rem' }; // label 13
const CELL_FONT = { fontSize: '0.875rem' }; // sm 14

/**
 * Keep activation keys and clicks that happen inside a row's controls (actions
 * menu, selection checkbox) from reaching the row's own handler. React
 * synthetic events also bubble out of portalled children, so Enter on an item
 * of a three-dot menu would otherwise run the action *and* navigate to the row.
 * Only Enter and Space are stopped: other keys (Tab, Escape, Ctrl+K) must keep
 * reaching global shortcuts.
 */
const isActivationKey = (event: KeyboardEvent<HTMLElement>) =>
  event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar';

const rowControlEvents = {
  onClick: (event: MouseEvent<HTMLElement>) => event.stopPropagation(),
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => {
    if (isActivationKey(event)) event.stopPropagation();
  },
};

/** Enter/Space activate a row only when the row itself has focus. */
const activateRowOnKey = (event: KeyboardEvent<HTMLElement>, activate: () => void) => {
  if (event.target !== event.currentTarget) return;
  if (isActivationKey(event)) {
    event.preventDefault();
    activate();
  }
};

const ALIGN_CLASS = {
  left: 'text-left',
  right: 'text-right tabular-nums',
  center: 'text-center tabular-nums',
};

function Table<T extends Record<string, any>>({
  columns,
  data,
  isLoading = false,
  rowKey,
  onRowClick,
  sort,
  onSortChange,
  sortable = true,
  serverSorted = false,
  selectable = false,
  selectedKeys = [],
  onSelectionChange,
  bulkActions,
  entity = 'records',
  emptyVariant = 'empty',
  emptyAction,
  emptyMessage,
  className,
  minWidth = '48rem',
  fixedLayout = false,
  striped = false,
}: TableProps<T>) {
  /* A list endpoint that answers with something other than an array — a 200
   * missing its `data`, an error envelope, a shape change — used to reach
   * `data.map()` here and throw, unmounting the app. A table with no rows is
   * an empty table, so that is what it renders. */
  const source: T[] = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  /* A page that passes `sort` owns the state; every other list keeps it here,
   * so a table gets a working sort without the page threading state for it. */
  const [ownSort, setOwnSort] = useState<SortState | null>(null);
  const sortFieldId = useId();
  const isControlled = sort !== undefined;
  const activeSort = isControlled ? (sort ?? null) : ownSort;

  const rows: T[] = useMemo(() => {
    if (!activeSort || serverSorted) return source;
    return sortRows(source, activeSort.key, activeSort.direction);
  }, [source, activeSort, serverSorted]);

  const keyOf = useMemo(
    () => rowKey ?? ((row: T, index: number) => String(row.id ?? row._id ?? index)),
    [rowKey]
  );

  const allKeys = useMemo(() => rows.map((row, i) => keyOf(row, i)), [rows, keyOf]);
  const allSelected = selectable && rows.length > 0 && allKeys.every((k) => selectedKeys.includes(k));
  const someSelected = selectable && selectedKeys.length > 0 && !allSelected;

  /* On a phone a nine-column table crushes rather than reads. The card list
   * shows the first column as the row's title, the next few as label/value
   * pairs, and keeps the actions cell — the same data, laid out for the
   * device. Column priority decides what appears. */
  const actionsColumn = columns.find((c) => c.key === 'actions');
  const dataColumns = columns.filter((c) => c.key !== 'actions');
  const titleColumn = dataColumns[0];
  const cardColumns = dataColumns.slice(1).filter((c) => (c.priority ?? 'primary') === 'primary');

  const toggleAll = () => onSelectionChange?.(allSelected ? [] : allKeys);
  const toggleOne = (key: string) =>
    onSelectionChange?.(
      selectedKeys.includes(key) ? selectedKeys.filter((k) => k !== key) : [...selectedKeys, key]
    );

  /* Which columns get a sort control.
   *
   * An explicit `sortable` on the column always wins. Otherwise a column is
   * sortable when it has a heading to click and a value in the data to sort
   * on - which rules out the actions cell, an icon-only column, and a column
   * whose `render` builds its content from the whole row rather than from a
   * field of it. */
  const canSort = (column: TableColumn<T>) => {
    if (typeof column.sortable === 'boolean') return column.sortable;
    if (!sortable) return false;
    if (column.key === 'actions' || !column.label) return false;
    return source.some((row) => {
      const value = row[column.key];
      if (value === null || value === undefined) return false;
      // A cell already holding an element cannot be compared as data.
      return !(typeof value === 'object' && '$$typeof' in (value as object));
    });
  };

  /* The phone list only shows the title column and the primary ones, so those
   * are the only columns its sort field offers. Offering a column the cards do
   * not render reorders the list by something invisible. */
  const mobileSortColumns = [titleColumn, ...cardColumns].filter(
    (column): column is TableColumn<T> => Boolean(column) && canSort(column!)
  );

  const desktopSortColumns = columns.filter(canSort);

  const applySort = (next: SortState | null) => {
    if (!isControlled) setOwnSort(next);
    onSortChange?.(next);
  };

  const requestSort = (key: string) => applySort(nextSortState(activeSort, key));

  /* The standard "Sort by" options: newest / oldest by when the record was
   * created (when rows carry `createdAt` and no column already sorts on it),
   * then both directions of every sortable column, worded for its data. */
  const hasCreatedAt =
    sortable && !columns.some((c) => c.key === 'createdAt') && source.some((row) => row.createdAt);
  const sortOptions = (sortColumns: TableColumn<T>[]) => {
    const options: { value: string; label: string }[] = hasCreatedAt
      ? [
          { value: 'createdAt:desc', label: 'Newest first' },
          { value: 'createdAt:asc', label: 'Oldest first' },
        ]
      : [];
    for (const column of sortColumns) {
      const kind = valueKind(source.map((row) => row[column.key]));
      const [asc, desc] =
        kind === 'date'
          ? ['Oldest first', 'Newest first']
          : kind === 'number'
            ? ['Low to high', 'High to low']
            : ['A to Z', 'Z to A'];
      options.push(
        { value: column.key + ':asc', label: `${column.label} (${asc})` },
        { value: column.key + ':desc', label: `${column.label} (${desc})` }
      );
    }
    return options;
  };

  const renderSortMenu = (sortColumns: TableColumn<T>[], id: string, className: string) => {
    const options = sortOptions(sortColumns);
    if (options.length === 0) return null;
    return (
      <div className={cn('items-center gap-2', className)}>
        <label htmlFor={id} style={CELL_FONT} className="flex-shrink-0 text-muted-foreground">
          Sort by
        </label>
        <select
          id={id}
          value={activeSort ? activeSort.key + ':' + activeSort.direction : ''}
          onChange={(event) => {
            const [key, direction] = event.target.value.split(':');
            applySort(key ? { key, direction: direction as SortState['direction'] } : null);
          }}
          className="min-w-0 flex-1 text-sm md:w-56 md:flex-none"
        >
          <option value="">Default order</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  };

  const cellValue = (column: TableColumn<T>, row: T, index: number) =>
    column.render ? column.render(row[column.key], row, index) : (row[column.key] ?? '—');

  if (isLoading) {
    /* The placeholder is shaped like what replaces it. Below `md` that is a
     * list of bordered cards — the page no longer draws a surface around the
     * table there, so a bare run of shimmer bars would sit on the background
     * with no frame at all and the list would appear to jump into a box once
     * it loaded. */
    return (
      <div className={cn('space-y-3', className)} aria-busy="true">
        <ul className="space-y-2 sm:space-y-3 md:hidden">
          {Array.from({ length: 6 }).map((_, row) => (
            <li key={row} className="rounded-lg border border-border bg-card p-2.5 sm:p-3">
              <Skeleton className="h-4 w-2/5 max-w-full" />
              <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
                {Array.from({ length: Math.min(4, Math.max(2, cardColumns.length)) }).map((_, cell) => (
                  <div key={cell} className="min-w-0 space-y-1">
                    <Skeleton className="h-3 w-1/2 max-w-full" />
                    <Skeleton className="h-3.5 w-3/4 max-w-full" />
                  </div>
                ))}
              </div>
            </li>
          ))}
        </ul>
        <div className="hidden rounded-lg border border-border md:block">
          <TableSkeleton columns={columns.length + (selectable ? 1 : 0)} />
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        variant={emptyVariant}
        entity={entity}
        title={emptyMessage}
        action={emptyAction}
        className={className}
      />
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {selectable && selectedKeys.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-accent/40 px-3 py-2">
          <p className="text-sm font-medium tabular-nums text-foreground">{selectedKeys.length} selected</p>
          <div className="flex items-center gap-2">
            {bulkActions}
            <button
              type="button"
              onClick={() => onSelectionChange?.([])}
              className="rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* ---- Sort control ------------------------------------------------
          One "Sort by" menu with the standard options, at every width. Below
          `md` the header row is replaced by cards, so it is the only way to
          sort there and offers just the columns the cards show; from `md` up
          it sits beside the clickable headers and offers every sortable one. */}
      {(!serverSorted || onSortChange) && (
        <>
          {renderSortMenu(mobileSortColumns, sortFieldId, 'flex md:hidden')}
          {renderSortMenu(desktopSortColumns, sortFieldId + '-md', 'hidden md:flex md:justify-end')}
        </>
      )}

      {/* ---- Phone: one card per record ---------------------------------- */}
      <ul className="space-y-2 sm:space-y-3 md:hidden">
        {rows.map((row, rowIndex) => {
          const key = keyOf(row, rowIndex);
          const selected = selectedKeys.includes(key);
          return (
            <li key={key}>
              <div
                role={onRowClick ? 'button' : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (event) => activateRowOnKey(event, () => onRowClick(row)) : undefined}
                className={cn(
                  'min-w-0 rounded-xl border border-border/80 bg-card p-2.5 transition-colors sm:p-3',
                  selected && 'border-primary bg-accent',
                  onRowClick &&
                    'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
                )}
              >
                <div className="flex items-start gap-3">
                  {selectable && (
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleOne(key)}
                      {...rowControlEvents}
                      aria-label={'Select row ' + (rowIndex + 1)}
                      className="mt-0.5 h-4 w-4 flex-shrink-0 rounded-sm border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      {titleColumn && (
                        /* A column's `render` returns arbitrary JSX — several return a
                         * <div> or a <p>. Inside a <p> the browser silently closes the
                         * paragraph early, so the content escaped this truncation box
                         * and the card layout broke on phones. A <div> nests anything. */
                        <div style={HEAD_FONT} className="min-w-0 flex-1 truncate font-medium text-foreground">
                          {cellValue(titleColumn, row, rowIndex)}
                        </div>
                      )}

                      {actionsColumn && (
                        /* Actions sit beside the title, not in a footer row below it —
                         * a separate bordered row per card was most of the extra
                         * height a phone list carried, and it pushed a row's actions
                         * onto their own line instead of staying level with the record
                         * they act on. */
                        /* Click and Enter/Space are both stopped: with only the click
                         * stopped, Enter on a row action ran the action and then the
                         * row's own handler — deleting a record and navigating to it
                         * in one keystroke. */
                        <div className="flex-shrink-0" {...rowControlEvents}>
                          {cellValue(actionsColumn, row, rowIndex)}
                        </div>
                      )}

                      {onRowClick && !actionsColumn && (
                        <FiChevronRight
                          className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    {cardColumns.length > 0 && (
                      <dl className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
                        {cardColumns.map((column) => (
                          <div key={column.key} className="min-w-0">
                            <dt style={CELL_FONT} className="text-muted-foreground">
                              {column.label}
                            </dt>
                            <dd style={CELL_FONT} className="truncate text-foreground">
                              {cellValue(column, row, rowIndex)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {/* ---- Tablet and up: the table ------------------------------------ */}
      <div className="data-table-surface hidden overflow-x-auto rounded-xl border border-border/80 md:block">
        <table
          className="data-table w-full border-collapse"
          style={{ minWidth, ...(fixedLayout ? { tableLayout: 'fixed' as const } : {}) }}
        >
          <thead className="sticky top-0 z-10 bg-muted/60">
            <tr className="border-b border-border">
              {selectable && (
                <th scope="col" className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(node) => {
                      if (node) node.indeterminate = someSelected;
                    }}
                    onChange={toggleAll}
                    aria-label={allSelected ? 'Clear selection' : 'Select all rows on this page'}
                    className="h-4 w-4 rounded-sm border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </th>
              )}
              {columns.map((column) => {
                const isSorted = activeSort?.key === column.key;
                const direction = isSorted ? activeSort!.direction : null;
                const sortableColumn = canSort(column);
                const headAlign = column.headerAlign ?? column.align ?? 'left';
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={
                      sortableColumn
                        ? isSorted
                          ? direction === 'asc'
                            ? 'ascending'
                            : 'descending'
                          : 'none'
                        : undefined
                    }
                    /* A fixed layout reads `width`; an auto one only honours
                     * `minWidth`, and would stretch the column past it. */
                    style={{
                      ...HEAD_FONT,
                      ...(column.width
                        ? fixedLayout
                          ? { width: column.width }
                          : { minWidth: column.width }
                        : {}),
                    }}
                    className={cn(
                      /* Size comes from HEAD_FONT. `whitespace-nowrap` stops
                       * a two-word heading folding into its neighbour. */
                      'whitespace-nowrap bg-muted/60 px-4 py-2.5 font-semibold text-muted-foreground',
                      ALIGN_CLASS[column.headerAlign ?? column.align ?? 'left'],
                      PRIORITY_CLASS[column.priority ?? 'primary']
                    )}
                  >
                    {sortableColumn ? (
                      <button
                        type="button"
                        onClick={() => requestSort(column.key)}
                        title={
                          direction === 'asc'
                            ? 'Sort ' + column.label + ' descending'
                            : direction === 'desc'
                              ? 'Stop sorting by ' + column.label
                              : 'Sort ' + column.label + ' ascending'
                        }
                        /* Full width, not `inline-flex`: the button then owns
                         * the whole cell and its own justify decides where the
                         * heading sits, so it lands on exactly the edge the
                         * cells below use. Every heading carries the same
                         * label-to-chevron gap, centred ones included - a
                         * spacer that squared the centring off against the
                         * digits made that column's gap read as the odd one. */
                        className={cn(
                          'flex w-full items-center gap-1.5 rounded-sm transition-colors',
                          'hover:text-foreground focus-visible:outline-none focus-visible:ring-2',
                          'focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-muted',
                          headAlign === 'right'
                            ? 'flex-row-reverse justify-start'
                            : headAlign === 'center'
                              ? 'justify-center'
                              : 'justify-start',
                          isSorted && 'text-foreground'
                        )}
                      >
                        <span className="min-w-0 truncate">{column.label}</span>
                        <SortIndicator direction={direction} />
                      </button>
                    ) : (
                      column.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-border bg-card">
            {rows.map((row, rowIndex) => {
              const key = keyOf(row, rowIndex);
              const selected = selectedKeys.includes(key);
              return (
                <tr
                  key={key}
                  /* Row click is keyboard-operable: focusable, and Enter or
                   * Space activate it the way a real control does. */
                  tabIndex={onRowClick ? 0 : undefined}
                  role={onRowClick ? 'button' : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? (event) => activateRowOnKey(event, () => onRowClick(row)) : undefined}
                  className={cn(
                    'transition-colors',
                    /* Selection, then the stripe, then hover - written as one
                     * class rather than an `even:` variant, whose extra
                     * specificity would have outranked the selected tint. */
                    selected
                      ? 'bg-accent'
                      : cn(striped && rowIndex % 2 === 1 && 'bg-muted/40', 'hover:bg-accent/60'),
                    onRowClick &&
                      'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring'
                  )}
                >
                  {selectable && (
                    <td className="w-10 px-3 py-3" {...rowControlEvents}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggleOne(key)}
                        aria-label={'Select row ' + (rowIndex + 1)}
                        className="h-4 w-4 rounded-sm border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      style={CELL_FONT}
                      /* The actions cell must not leak clicks or Enter/Space to the row. */
                      {...(column.key === 'actions' ? rowControlEvents : {})}
                      /* The actions cell holds controls, not text - clipping it
                       * would cut a menu button in half. */
                      title={
                        fixedLayout && typeof row[column.key] === 'string'
                          ? (row[column.key] as string)
                          : undefined
                      }
                      className={cn(
                        'px-4 py-3.5 text-foreground',
                        ALIGN_CLASS[column.align ?? 'left'],
                        PRIORITY_CLASS[column.priority ?? 'primary']
                      )}
                    >
                      {/* Two lines, then an ellipsis. The clamp lives on an
                        * inner div because it needs `display: -webkit-box`,
                        * which on the cell itself would stop it behaving as a
                        * table cell at all. */}
                      {fixedLayout && column.key !== 'actions' ? (
                        /* The clamp turns this into a `-webkit-box`, so it
                         * repeats the cell's alignment rather than trusting it
                         * to inherit through a box that is not a block. */
                        <div
                          className={cn(
                            'line-clamp-2 break-words leading-snug',
                            ALIGN_CLASS[column.align ?? 'left']
                          )}
                        >
                          {cellValue(column, row, rowIndex)}
                        </div>
                      ) : (
                        cellValue(column, row, rowIndex)
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Table;
