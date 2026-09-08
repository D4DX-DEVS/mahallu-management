import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { cn } from '@/utils/cn';
export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (items: number) => void;
  /*
   * Plural noun for the records, e.g. "families". Beats "results". */
  entity?: string;
  className?: string;
}
const PAGE_SIZES = [
  25, 50, 100,
]; /** * Numbered page buttons with ellipsis. The previous build used a number input, * which fired a navigation on every keystroke — typing "12" loaded page 1 first * — and had no accessible name on prev/next. */
function pageWindow(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, 'gap', total];
  if (current >= total - 3) return [1, 'gap', total - 4, total - 3, total - 2, total - 1, total];
  return [1, 'gap', current - 1, current, current + 1, 'gap', total];
}
export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange,
  entity = 'items',
  className,
}: PaginationProps) {
  /*
   * Every figure is normalised before it is used.
   *
   * A caller that spread the API's `{page, limit, total, totalPages}` straight
   * in left three of these props undefined, and the bar rendered "NaN–NaN of
   * undefined" above page buttons whose label and key were both NaN. The zero
   * check did not catch it either, because `undefined === 0` is false.
   */
  const safeTotalItems = Number.isFinite(totalItems) && totalItems > 0 ? Math.floor(totalItems) : 0;
  if (safeTotalItems === 0) return null;
  const safePerPage = Number.isFinite(itemsPerPage) && itemsPerPage > 0 ? Math.floor(itemsPerPage) : 25;
  const safeTotalPages =
    Number.isFinite(totalPages) && totalPages > 0
      ? Math.floor(totalPages)
      : Math.max(1, Math.ceil(safeTotalItems / Math.max(1, safePerPage)));
  const safeCurrentPage = Math.min(Math.max(1, Math.floor(currentPage) || 1), safeTotalPages);
  const startItem = (safeCurrentPage - 1) * safePerPage + 1;
  const endItem = Math.min(safeCurrentPage * safePerPage, safeTotalItems);
  const btn =
    'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:pointer-events-none';
  return (
    <nav
      aria-label="Pagination"
      className={cn('flex w-full flex-col items-center justify-between gap-3 sm:flex-row', className)}
    >
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <p className="text-label text-muted-foreground tabular-nums">
          {startItem}–{endItem} of {safeTotalItems} {entity}
        </p>
        {onItemsPerPageChange && (
          <label className="flex items-center gap-1.5 text-label text-muted-foreground">
            <span>Rows</span>
            <select
              aria-label="Rows per page"
              value={safePerPage}
              onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
              className="h-8 rounded-md border border-input bg-background px-2 text-label text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="flex max-w-full flex-wrap items-center justify-center gap-1">
        <button
          type="button"
          className={cn(btn, 'text-muted-foreground hover:bg-accent hover:text-accent-foreground')}
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage <= 1}
          aria-label="Previous page"
        >
          <FiChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        {pageWindow(safeCurrentPage, safeTotalPages).map((page, index) =>
          page === 'gap' ? (
            <span key={'gap-' + index} className="px-1 text-label text-muted-foreground" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              aria-label={'Page ' + page}
              aria-current={page === safeCurrentPage ? 'page' : undefined}
              className={cn(
                btn,
                'tabular-nums',
                page === safeCurrentPage
                  ? 'bg-primary font-medium text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {page}
            </button>
          )
        )}
        <button
          type="button"
          className={cn(btn, 'text-muted-foreground hover:bg-accent hover:text-accent-foreground')}
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage >= safeTotalPages}
          aria-label="Next page"
        >
          <FiChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
