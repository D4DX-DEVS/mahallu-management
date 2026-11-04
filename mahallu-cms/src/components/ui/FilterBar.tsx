import { ReactNode } from 'react';
import { FiSearch, FiX } from 'react-icons/fi';
import { cn } from '@/utils/cn';

export interface FilterBarProps {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  /** Filter controls (Segmented, Select, filter button ...) shown after the search box */
  children?: ReactNode;
  /** Right-aligned controls (refresh, export, import ...) */
  actions?: ReactNode;
  className?: string;
}

/**
 * Toolbar row that sits at the top of a list Card: search + filters on the left, actions on the right.
 * Put it inside a <Card padding="none"> with a bottom border, then render the Table below.
 */
export default function FilterBar({ search, children, actions, className }: FilterBarProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2 border-b sm:gap-2.5 border-line-soft px-3.5 py-3 dark:border-surface-border', className)}>
      {search && (
        <label className="flex h-11 w-full min-w-0 items-center sm:h-[34px] sm:w-auto sm:max-w-[340px] sm:flex-[1_1_260px] gap-2 rounded-[10px] border border-line bg-[#F4F7F5] px-3 text-[#7B8983] transition-[border-color,box-shadow] focus-within:border-primary-600 focus-within:bg-white focus-within:shadow-focus dark:border-surface-border dark:bg-surface-raised dark:text-surface-muted dark:focus-within:border-brand-lime">
          <FiSearch className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <input
            type="search"
            value={search.value}
            onChange={(e) => search.onChange(e.target.value)}
            placeholder={search.placeholder ?? 'Search'}
            aria-label={search.placeholder ?? 'Search'}
            className="min-w-0 flex-1 max-sm:self-stretch bg-transparent text-base sm:text-xs text-[#18231E] placeholder:text-[#7B8983] focus:outline-none dark:text-surface-text dark:placeholder:text-surface-muted [&::-webkit-search-cancel-button]:hidden"
          />
          {search.value && (
            <button type="button" aria-label="Clear search" onClick={() => search.onChange('')} className="flex h-8 w-8 items-center justify-center text-[#98A59F] hover:text-[#3A4741] dark:hover:text-surface-text">
              <FiX className="h-3.5 w-3.5" />
            </button>
          )}
        </label>
      )}
      {children && <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:contents">{children}</div>}
      {actions && <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">{actions}</div>}
    </div>
  );
}
