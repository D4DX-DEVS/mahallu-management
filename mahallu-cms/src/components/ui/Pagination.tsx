import { RiArrowLeftDoubleLine, RiArrowLeftSLine, RiArrowRightDoubleLine, RiArrowRightSLine } from 'react-icons/ri';
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
  const pageBtn =
    'inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-medium tabular-nums transition-colors ' +
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  const arrowBtn =
    'inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-subtle ' +
    'hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40';
  const go = (page: number) => onPageChange(Math.min(Math.max(1, page), safeTotalPages));
  return (
    /* Reference layout: page position on the left, the pager centred, page
     * size on the right. On a phone the pager takes its own row underneath. */
    <nav
      aria-label="Pagination"
      className={cn(
        'flex w-full flex-wrap items-center justify-between gap-3 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:gap-4',
        className
      )}
    >
      <p className="text-sm text-muted-foreground tabular-nums" title={`${startItem}–${endItem} of ${safeTotalItems} ${entity}`}>
        Page <span className="font-medium text-foreground">{safeCurrentPage}</span> of {safeTotalPages}
        <span className="hidden lg:inline"> · {safeTotalItems.toLocaleString()} {entity}</span>
      </p>

      <div className="order-last flex w-full flex-wrap items-center justify-center gap-1 sm:order-none sm:w-auto">
        <button type="button" className={cn(arrowBtn, 'hidden sm:inline-flex')} onClick={() => go(1)} disabled={safeCurrentPage <= 1} aria-label="First page">
          <RiArrowLeftDoubleLine className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <button type="button" className={arrowBtn} onClick={() => go(safeCurrentPage - 1)} disabled={safeCurrentPage <= 1} aria-label="Previous page">
          <RiArrowLeftSLine className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        {pageWindow(safeCurrentPage, safeTotalPages).map((page, index) =>
          page === 'gap' ? (
            <span
              key={'gap-' + index}
              className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-border text-sm text-muted-foreground"
              aria-hidden="true"
            >
              …
            </span>
          ) : (
            <button
              key={page}
              type="button"
              onClick={() => go(page)}
              aria-label={'Page ' + page}
              aria-current={page === safeCurrentPage ? 'page' : undefined}
              className={cn(
                pageBtn,
                page === safeCurrentPage
                  ? 'border border-foreground/15 bg-subtle text-foreground shadow-sm'
                  : 'border border-border text-muted-foreground hover:bg-subtle hover:text-foreground'
              )}
            >
              {page}
            </button>
          )
        )}
        <button type="button" className={arrowBtn} onClick={() => go(safeCurrentPage + 1)} disabled={safeCurrentPage >= safeTotalPages} aria-label="Next page">
          <RiArrowRightSLine className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
        <button type="button" className={cn(arrowBtn, 'hidden sm:inline-flex')} onClick={() => go(safeTotalPages)} disabled={safeCurrentPage >= safeTotalPages} aria-label="Last page">
          <RiArrowRightDoubleLine className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </div>

      <div className="flex justify-end">
        {onItemsPerPageChange && (
          <select
            aria-label="Rows per page"
            value={safePerPage}
            onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
            className="!h-8 rounded-lg !border-border bg-card !px-2.5 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {Array.from(new Set([...PAGE_SIZES, safePerPage]))
              .sort((a, b) => a - b)
              .map((size) => (
                <option key={size} value={size}>
                  {size} / page
                </option>
              ))}
          </select>
        )}
      </div>
    </nav>
  );
}
