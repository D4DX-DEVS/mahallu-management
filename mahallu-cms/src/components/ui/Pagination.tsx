import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { cn } from '@/utils/cn';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange?: (items: number) => void;
  className?: string;
}

/** Compact page list: 1 … 4 5 6 … 20 */
function pageWindow(current: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = new Set<number>([1, total, current, current - 1, current + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) out.push('gap');
    out.push(p);
  });
  return out;
}

const chip =
  'inline-flex h-[30px] min-w-[30px] max-sm:h-10 max-sm:min-w-10 items-center justify-center rounded-lg border px-2 text-xs font-semibold transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] disabled:pointer-events-none disabled:opacity-40';
const chipIdle =
  'border-line-strong bg-white text-[#3A4741] hover:bg-[#F4F7F5] dark:border-surface-border-strong dark:bg-surface-raised dark:text-surface-text dark:hover:bg-surface-hover';
const chipActive = 'border-primary-700 bg-primary-700 text-white dark:border-brand-lime dark:bg-brand-lime dark:text-primary-950';

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  className,
}: PaginationProps) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className={cn('flex flex-col items-center justify-between gap-2 sm:flex-row sm:gap-3', className)}>
      <p className="text-xs text-[#7B8983] dark:text-surface-muted">
        Showing <b className="font-bold text-[#18231E] dark:text-surface-text">{startItem}-{endItem}</b> of{' '}
        <b className="font-bold text-[#18231E] dark:text-surface-text">{totalItems}</b> results
      </p>
      <nav className="flex max-w-full items-center gap-1.5" aria-label="Pagination">
        <button
          type="button"
          aria-label="Previous page"
          className={cn(chip, chipIdle)}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          <FiChevronLeft className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[4.5rem] px-1 text-center text-xs font-semibold tabular-nums text-[#3A4741] sm:hidden dark:text-surface-text" aria-live="polite">
          {currentPage} / {Math.max(totalPages, 1)}
        </span>
        {pageWindow(currentPage, totalPages).map((p, i) =>
          p === 'gap' ? (
            <span key={`gap-${i}`} className="hidden px-1 sm:inline text-xs text-[#98A59F]" aria-hidden="true">…</span>
          ) : (
            <button
              key={p}
              type="button"
              aria-label={`Page ${p}`}
              aria-current={p === currentPage ? 'page' : undefined}
              className={cn(chip, 'max-sm:hidden', p === currentPage ? chipActive : chipIdle)}
              onClick={() => onPageChange(p)}
            >
              {p}
            </button>
          )
        )}
        <button
          type="button"
          aria-label="Next page"
          className={cn(chip, chipIdle)}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          <FiChevronRight className="h-3.5 w-3.5" />
        </button>
      </nav>
    </div>
  );
}
