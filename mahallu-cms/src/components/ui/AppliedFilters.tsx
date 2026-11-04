import { FiX } from 'react-icons/fi';
import type { FilterRecord } from '@/hooks/useUrlFilters';

export interface AppliedFilterConfig {
  label: string;
  /** Map a raw value to display text (defaults to the raw value). */
  format?: (value: string) => string;
}

export interface AppliedFiltersProps {
  filters: {
    activeFilters: FilterRecord;
    resetFilter: (key: string) => void;
    clear: () => void;
  };
  /** Per-key label/format; keys without config show the key name. `q` is the search box. */
  config?: Record<string, AppliedFilterConfig>;
}

/** Removable chips for every active filter, shown under the FilterBar. Renders nothing when no filter is active. */
export default function AppliedFilters({ filters, config = {} }: AppliedFiltersProps) {
  const entries = Object.entries(filters.activeFilters);
  if (entries.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-line-soft px-3.5 py-2 dark:border-surface-border" aria-label="Applied filters">
      {entries.map(([key, value]) => {
        const label = key === 'q' ? 'Search' : config[key]?.label ?? key;
        const shown = key === 'q' ? `"${value}"` : config[key]?.format?.(value) ?? (value === '' ? 'None' : value);
        return (
          <span key={key} className="inline-flex h-6 items-center gap-1 max-sm:h-10 rounded-full border border-[#CFE3D8] bg-mint pl-2.5 pr-1 text-[12px] font-semibold text-primary-800 dark:border-brand-lime/30 dark:bg-brand-lime/10 dark:text-brand-lime">
            <span className="font-medium opacity-70">{label}:</span> {shown}
            <button
              type="button"
              aria-label={`Remove ${label} filter`}
              onClick={() => filters.resetFilter(key)}
              className="ml-0.5 flex h-4 w-4 max-sm:h-9 max-sm:w-9 items-center justify-center rounded-full hover:bg-primary-700/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-lime"
            >
              <FiX className="h-3 w-3" />
            </button>
          </span>
        );
      })}
      <button type="button" onClick={filters.clear} className="ml-1 text-[12px] max-sm:inline-flex max-sm:h-10 max-sm:items-center max-sm:px-2 font-semibold text-[#5B6963] underline-offset-2 hover:underline dark:text-surface-muted">
        Clear all
      </button>
    </div>
  );
}
