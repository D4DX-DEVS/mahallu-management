import { ReactNode, useEffect } from 'react';
import {
  RiArrowDownSLine,
  RiCheckLine,
  RiDownload2Line,
  RiFile3Line,
  RiFileTextLine,
  RiFilter3Line,
  RiRefreshLine,
  RiSortDesc,
} from 'react-icons/ri';
import Button from './Button';
import ExpandableSearch from './ExpandableSearch';
import ActionBar from './ActionBar';
import Dropdown, { DropdownItem } from './Dropdown';
import { useTableSlot } from './tableSlot';
import { cn } from '@/utils/cn';
interface TableToolbarProps {
  /** Omit both for a list with nothing to search; the rest of the row is unchanged. */
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  /*
   * What is being searched, e.g. "families". Written into the placeholder. */
  searchEntity?: string;
  onFilterClick?: () => void;
  isFilterVisible?: boolean;
  hasFilters?: boolean;
  /*
   * Number of filters currently applied. Shown as a count on the button. */
  activeFilterCount?: number;
  onRefresh?: () => void;
  /*
   * JSON is a developer format and is no longer offered to end users. */
  onExport?: (type: 'csv' | 'pdf') => void;
  isExporting?: boolean;
  /**
   * The page's own actions, e.g. "New Family". Give every one of them an
   * `icon` and `collapseLabel` so the row still fits a 320px phone.
   */
  actionButtons?: ReactNode;
  tabs?: ReactNode;
  /** A server-side sort owned by the page. Without it, the Table's own sort sits here. */
  sortOptions?: Array<{ value: string; label: string }>;
  sortValue?: string;
  onSortChange?: (value: string) => void;
  className?: string;
}

/** The "Sort by" trigger, shared with the Table's own sort control. */
export function SortTrigger({ activeLabel }: { activeLabel?: string }) {
  return (
    <Button
      variant="outline"
      icon={<RiSortDesc />}
      collapseLabel
      trailing={
        <span className="hidden items-center gap-1 sm:flex">
          {activeLabel && <span className="max-w-[9rem] truncate text-xs font-normal text-muted-foreground">{activeLabel}</span>}
          <RiArrowDownSLine className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </span>
      }
    >
      Sort by
    </Button>
  );
}

/** Menu items with a check against the current choice. */
export function sortMenuItems(
  options: Array<{ value: string; label: string }>,
  current: string | undefined,
  onSelect: (value: string) => void
): DropdownItem[] {
  return options.map((option) => ({
    label: option.label,
    icon: option.value === current ? <RiCheckLine className="h-4 w-4 text-primary" /> : <span />,
    onClick: () => onSelect(option.value),
    className: option.value === current ? 'font-medium' : undefined,
  }));
}

export default function TableToolbar({
  searchQuery,
  onSearchChange,
  searchEntity,
  onFilterClick,
  isFilterVisible = false,
  hasFilters = false,
  activeFilterCount = 0,
  onRefresh,
  onExport,
  isExporting,
  actionButtons,
  tabs,
  sortOptions,
  sortValue,
  onSortChange,
  className,
}: TableToolbarProps) {
  const slot = useTableSlot();
  const ownsSort = Boolean(sortOptions && sortOptions.length > 0);
  const setToolbarSorts = slot?.setToolbarSorts;
  useEffect(() => {
    setToolbarSorts?.(ownsSort);
  }, [ownsSort, setToolbarSorts]);

  const exportItems: DropdownItem[] = [
    { label: 'Export as CSV', icon: <RiFileTextLine />, onClick: () => onExport?.('csv'), disabled: isExporting },
    { label: 'Export as PDF', icon: <RiFile3Line />, onClick: () => onExport?.('pdf'), disabled: isExporting },
  ];
  const selectedSort = sortOptions?.find((option) => option.value === sortValue);

  return (
    /* One row: status tabs at the start; search, filter, sort, refresh,
     * export and the page's actions together at the end. Labelled controls
     * collapse to their glyph below `sm` so the row never wraps. */
    <ActionBar className={cn('mb-4', className)} leading={tabs}>
      {onSearchChange && (
        <ExpandableSearch value={searchQuery ?? ''} onChange={onSearchChange} entity={searchEntity} />
      )}
      {hasFilters && onFilterClick && (
        <Button
          variant="outline"
          onClick={onFilterClick}
          aria-expanded={isFilterVisible}
          className={cn('flex-shrink-0', isFilterVisible && 'border-primary/40 bg-primary/5 text-primary hover:bg-primary/10')}
          icon={<RiFilter3Line />}
          collapseLabel
          trailing={
            activeFilterCount > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold tabular-nums text-primary-foreground">
                {activeFilterCount}
              </span>
            ) : undefined
          }
        >
          Filter
        </Button>
      )}
      {ownsSort ? (
        <Dropdown
          label="Sort records"
          items={sortMenuItems(sortOptions!, sortValue, (value) => onSortChange?.(value))}
          trigger={<SortTrigger activeLabel={selectedSort?.label} />}
        />
      ) : (
        /* The Table below portals its own sort control in here. */
        <div ref={slot?.setSlot} className="contents" />
      )}
      {onRefresh && (
        <Button
          variant="outline"
          size="icon"
          onClick={onRefresh}
          aria-label="Refresh list"
          title="Refresh list"
          className="flex-shrink-0"
        >
          <RiRefreshLine className="h-4 w-4" />
        </Button>
      )}
      {onExport && (
        <Dropdown
          label="Export"
          trigger={
            <Button
              variant="outline"
              isLoading={isExporting}
              loadingText="Exporting"
              icon={<RiDownload2Line />}
              collapseLabel
            >
              Export
            </Button>
          }
          items={exportItems}
        />
      )}
      {actionButtons}
    </ActionBar>
  );
}
