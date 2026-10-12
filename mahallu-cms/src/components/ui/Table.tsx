import { useState, useEffect, useRef, ReactNode } from 'react';
import { TableColumn } from '@/types';
import { cn } from '@/utils/cn';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';
import Button from './Button';
import TableCards from './TableCards';
import { useIsPhone } from '@/hooks/useMediaQuery';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { FiFileText, FiFile, FiDownload } from 'react-icons/fi';

export interface TableProps<T = any> {
  columns: TableColumn<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  className?: string;
  exportFilename?: string;
  exportTitle?: string;
  showExport?: boolean;
  /**
   * Function to fetch all filtered data for export.
   * Should return a Promise that resolves to an array of all filtered data.
   * If not provided, exports will use the current page data.
   */
  onExportAll?: () => Promise<T[]>;
  /** Optional row selection (adds a checkbox column + bulk-action bar). */
  selectable?: boolean;
  /** Stable row id for selection; defaults to row.id, then the row index. */
  getRowId?: (row: T, index: number) => string;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  /** Rendered on the right of the bulk bar while rows are selected. Receives the selected ids. */
  bulkActions?: (selectedIds: string[]) => ReactNode;
  /** Row height: comfortable = 44px (default), compact = 36px. */
  density?: 'comfortable' | 'compact';
  /** Keep the header visible while the body scrolls inside the card. Default true. */
  stickyHeader?: boolean;
  /** True when search/filters are narrowing the list: an empty result then reads as "no results for these filters". */
  filtersActive?: boolean;
  /** Shown as a "Clear filters" button in the empty-filter state. */
  onClearFilters?: () => void;
  /**
   * Phone layout (< 640px). 'cards' (default) renders one card per row: first column (name / avatar) as the title,
   * status + actions columns at the right, up to 4 key fields, the rest behind "n more". 'scroll' keeps the
   * table and scrolls it sideways inside its card. Tablets and desktops always get the table.
   */
  mobileLayout?: 'cards' | 'scroll';
}

const alignClass = (a?: 'left' | 'right' | 'center') =>
  a === 'right' ? 'text-right' : a === 'center' ? 'text-center' : 'text-left';
const justifyClass = (a?: 'left' | 'right' | 'center') =>
  a === 'right' ? 'justify-end' : a === 'center' ? 'justify-center' : '';

function Table<T extends Record<string, any>>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No data available',
  onRowClick,
  className,
  exportFilename = 'export',
  exportTitle,
  showExport = true,
  onExportAll,
  selectable = false,
  getRowId,
  selectedIds,
  onSelectionChange,
  bulkActions,
  density = 'comfortable',
  stickyHeader = true,
  filtersActive = false,
  onClearFilters,
  mobileLayout = 'cards',
}: TableProps<T>) {
  const isPhone = useIsPhone();
  const asCards = isPhone && mobileLayout === 'cards' && columns.length > 1;
  const [innerSelected, setInnerSelected] = useState<string[]>([]);
  const selected = selectedIds ?? innerSelected;
  const setSelected = (ids: string[]) => {
    if (selectedIds === undefined) setInnerSelected(ids);
    onSelectionChange?.(ids);
  };
  const rowId = (row: T, index: number) => (getRowId ? getRowId(row, index) : String(row.id ?? index));
  const selectAllRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // true while content is hidden to the right of the viewport: only then does the sticky actions column cast a shadow
  const [moreRight, setMoreRight] = useState(false);
  const measureScroll = () => {
    const el = scrollRef.current;
    if (el) setMoreRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 1);
  };
  useEffect(() => {
    measureScroll();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measureScroll);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  });
  const compact = density === 'compact';

  // Uncontrolled selection only ever refers to rows that are on screen: drop stale ids when the page changes.
  useEffect(() => {
    if (selectedIds !== undefined) return;
    setInnerSelected((prev) => {
      if (prev.length === 0) return prev;
      const present = new Set(data.map((row, i) => rowId(row, i)));
      const kept = prev.filter((id) => present.has(id));
      return kept.length === prev.length ? prev : kept;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = selected.length > 0 && selected.length < data.length;
    }
  }, [selected.length, data.length]);
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState<'csv' | 'json' | 'pdf' | null>(null);

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setExporting(true);
      setExportType(type);
      
      // If onExportAll is provided, fetch all filtered data, otherwise use current page data
      const dataToExport = onExportAll ? await onExportAll() : data;
      
      if (dataToExport.length === 0) {
        toast.info('Nothing to export — this list is empty');
        return;
      }

      switch (type) {
        case 'csv':
          exportToCSV(columns, dataToExport, exportFilename);
          break;
        case 'json':
          exportToJSON(columns, dataToExport, exportFilename);
          break;
        case 'pdf':
          exportToPDF(columns, dataToExport, exportFilename, exportTitle);
          break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(getFriendlyError(error, "Couldn't export data. Check your connection and try again."));
    } finally {
      setExporting(false);
      setExportType(null);
    }
  };

  const handleExportCSV = () => handleExport('csv');
  const handleExportJSON = () => handleExport('json');
  const handleExportPDF = () => handleExport('pdf');

  if (isLoading) {
    return <LoadingSpinner size="lg" className="py-12" />;
  }

  if (data.length === 0) {
    if (filtersActive) {
      return (
        <EmptyState
          title="No results for these filters"
          description="Nothing matches the current search and filters. Try removing a filter or searching for something else."
          action={onClearFilters ? { label: 'Clear filters', onClick: onClearFilters } : undefined}
        />
      );
    }
    return <EmptyState title={emptyMessage} />;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {showExport && data.length > 0 && (
        <div className="flex flex-wrap items-center justify-end gap-2 pb-1">
          <span className="mr-1 hidden text-[12px] font-semibold uppercase tracking-[0.03em] sm:inline text-[#7B8983] dark:text-surface-muted">Export</span>
          <Button variant="secondary" size="sm" onClick={handleExportCSV} disabled={exporting} isLoading={exporting && exportType === 'csv'}>
            <FiFileText className="h-3.5 w-3.5" />
            CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExportJSON} disabled={exporting} isLoading={exporting && exportType === 'json'}>
            <FiFile className="h-3.5 w-3.5" />
            JSON
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExportPDF} disabled={exporting} isLoading={exporting && exportType === 'pdf'}>
            <FiDownload className="h-3.5 w-3.5" />
            PDF
          </Button>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-line dark:border-surface-border">
        {selectable && selected.length > 0 && (
          <div className="flex items-center gap-3 bg-primary-700 px-3.5 py-2 text-xs font-semibold text-white dark:bg-surface-raised dark:text-brand-lime" role="status">
            <span>{selected.length} selected</span>
            <button type="button" onClick={() => setSelected([])} className="rounded-md px-1.5 py-0.5 text-[12px] font-semibold text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-lime">
              Clear
            </button>
            <span className="ml-auto flex items-center gap-2">{bulkActions?.(selected)}</span>
          </div>
        )}
        {asCards ? (
          <>
            {selectable && (
              <label className="flex min-h-11 items-center gap-3 border-b border-line-soft bg-[#FAFCFB] px-3.5 text-xs font-semibold text-[#5B6963] dark:border-surface-border dark:bg-surface-card dark:text-surface-muted">
                <input
                  type="checkbox"
                  aria-label="Select all rows"
                  className="h-5 w-5 cursor-pointer rounded accent-primary-700 dark:accent-brand-lime"
                  checked={selected.length > 0 && selected.length === data.length}
                  onChange={(e) => setSelected(e.target.checked ? data.map(rowId) : [])}
                />
                Select all
              </label>
            )}
            <TableCards columns={columns} data={data} onRowClick={onRowClick} rowId={rowId} selectable={selectable} selected={selected} setSelected={setSelected} />
          </>
        ) : (
        <div className="relative">
        <div ref={scrollRef} data-table-scroll onScroll={measureScroll} className={cn('overflow-x-auto overscroll-x-contain', stickyHeader ? 'max-h-[70vh] max-h-[70dvh] overflow-y-auto' : 'overflow-y-visible')}>
          <table className="w-full min-w-max border-collapse text-[12.5px]">
            <thead className={cn('bg-[#FAFCFB] dark:bg-surface-card', stickyHeader && 'sticky top-0 z-10 shadow-[0_1px_0_0_#E3EBE7] dark:shadow-[0_1px_0_0_#2A3430]')}>
              <tr className="border-b border-line-soft dark:border-surface-border">
                {selectable && (
                  <th className="w-10 px-3.5 py-2.5">
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      aria-label="Select all rows"
                      className="h-4 w-4 cursor-pointer rounded accent-primary-700 dark:accent-brand-lime"
                      checked={selected.length > 0 && selected.length === data.length}
                      onChange={(e) => setSelected(e.target.checked ? data.map(rowId) : [])}
                    />
                  </th>
                )}
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={cn('whitespace-nowrap px-3.5 py-2.5 text-[12px] font-bold uppercase tracking-[0.03em] text-[#7B8983] dark:text-surface-muted', alignClass(column.align), column.key === 'actions' && cn('sticky right-0 z-[11] bg-[#FAFCFB] dark:bg-surface-card', moreRight && 'shadow-[-8px_0_8px_-8px_rgba(11,72,55,.18)]'))}
                  >
                    <div className={cn('flex items-center gap-1.5', justifyClass(column.align))}>
                      {column.label}
                      {column.sortable && <span className="text-[#98A59F]">↕</span>}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft bg-white dark:divide-surface-border dark:bg-surface-card">
              {data.map((row, rowIndex) => {
                const id = rowId(row, rowIndex);
                const isSelected = selectable && selected.includes(id);
                return (
                  <tr
                    key={rowIndex}
                    onClick={() => onRowClick?.(row)}
                    tabIndex={onRowClick ? 0 : undefined}
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                    className={cn(
                      compact ? 'h-9' : 'h-11',
                      'group text-[#18231E] transition-colors hover:bg-[#F6FAF8] dark:text-surface-text dark:hover:bg-surface-hover/60',
                      isSelected && 'bg-[#F3F9F5] dark:bg-brand-lime/10',
                      onRowClick && 'cursor-pointer focus-visible:bg-[#F6FAF8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-600 dark:focus-visible:ring-brand-lime'
                    )}
                  >
                    {selectable && (
                      <td className="w-10 px-3.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label="Select row"
                          className="h-4 w-4 cursor-pointer rounded accent-primary-700 dark:accent-brand-lime"
                          checked={isSelected}
                          onChange={(e) =>
                            setSelected(e.target.checked ? [...selected, id] : selected.filter((x) => x !== id))
                          }
                        />
                      </td>
                    )}
                    {columns.map((column) => {
                      const cell = column.render ? column.render(row[column.key], row, rowIndex) : row[column.key] ?? '-';
                      // short values never wrap; long free text may wrap inside a sensible width
                      const longText = typeof cell === 'string' && cell.length > 40;
                      return (
                      <td
                        key={column.key}
                        className={cn(
                          'px-3.5',
                          longText ? 'min-w-[16rem] whitespace-normal' : 'whitespace-nowrap',
                          compact ? 'py-1' : 'py-2',
                          alignClass(column.align),
                          column.align === 'right' && 'tabular-nums',
                          // Row actions stay reachable when the table scrolls sideways
                          column.key === 'actions' &&
                            cn(
                              'sticky right-0 z-[1] group-hover:bg-[#F6FAF8] dark:group-hover:bg-[#1C2420]',
                              moreRight && 'shadow-[-8px_0_8px_-8px_rgba(11,72,55,.18)]',
                              isSelected ? 'bg-[#F3F9F5] dark:bg-[#1B2A21]' : 'bg-white dark:bg-surface-card'
                            )
                        )}
                      >
                        {cell}
                      </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {moreRight && (
          <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-[12] w-6 bg-gradient-to-l from-black/[.07] to-transparent dark:from-white/[.08]" />
        )}
        </div>
        )}
      </div>
    </div>
  );
}

export default Table;
