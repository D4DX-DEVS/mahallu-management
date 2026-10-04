import { ReactNode } from 'react';
import { FiFilter, FiRefreshCw, FiDownload, FiFileText, FiFile, FiSliders } from 'react-icons/fi';
import Button from './Button';
import ExpandableSearch from './ExpandableSearch';
import Badge from './Badge';
import Dropdown, { DropdownItem } from './Dropdown';
import { cn } from '@/utils/cn';
interface TableToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
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
   * `icon` and `collapseLabel` so the row still fits a 320px phone — the
   * toolbar no longer wraps, so a named button that cannot shrink is a button
   * that pushes the row past the viewport.
   */
  actionButtons?: ReactNode;
  tabs?: ReactNode;
  sortOptions?: Array<{ value: string; label: string }>;
  sortValue?: string;
  onSortChange?: (value: string) => void;
  className?: string;
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
  const exportItems: DropdownItem[] = [
    { label: 'Export as CSV', icon: <FiFileText />, onClick: () => onExport?.('csv'), disabled: isExporting },
    { label: 'Export as PDF', icon: <FiFile />, onClick: () => onExport?.('pdf'), disabled: isExporting },
  ];
  const selectedSort = sortOptions?.find((option) => option.value === sortValue);
  const sortItems: DropdownItem[] = (sortOptions ?? []).map((option) => ({
    label: option.label,
    onClick: () => onSortChange?.(option.value),
    className: option.value === sortValue ? 'bg-accent text-accent-foreground' : undefined,
  }));
  return (
    /* One row at every width.
     *
     * This used to stack into a column below `sm` and let both halves wrap, so
     * a phone got search / filter / refresh on one line and export / "+ New
     * Committee" on the next — two rows of chrome above a list, and the count
     * of rows changed with the page. Nothing wraps now: the controls that have
     * a label collapse to their glyph below `sm` (see `Button.collapseLabel`),
     * while search keeps its full field on desktop,
     * which is what makes six controls fit across 320px — 6 x 40px plus five
     * 8px gaps is 280px, inside the 296px a 320px phone leaves after the
     * page's own gutters. */
    <div className={cn('mb-5 space-y-3', className)}>
      {tabs}
      <div className="flex items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {/* Search stays visible on desktop and collapses to a real icon button
            on phones. A query holds the field open so no filter is ever hidden. */}
        <ExpandableSearch
          value={searchQuery}
          onChange={onSearchChange}
          entity={searchEntity}
          desktopAlwaysVisible
        />
        {hasFilters && onFilterClick && (
          <Button
            variant="outline"
            onClick={onFilterClick}
            aria-expanded={isFilterVisible}
            className="flex-shrink-0"
            icon={<FiFilter />}
            collapseLabel
            /* The count survives the collapse: "filtered" is the one thing the
             * funnel glyph cannot say by itself. */
            trailing={
              activeFilterCount > 0 ? <Badge variant="primary">{activeFilterCount}</Badge> : undefined
            }
          >
            Filter
          </Button>
        )}
        {onRefresh && (
          <Button
            variant="outline"
            size="icon"
            onClick={onRefresh}
            aria-label="Refresh list"
            className="flex-shrink-0"
          >
            <FiRefreshCw className="h-4 w-4" />
          </Button>
        )}
      </div>
      {sortOptions && sortOptions.length > 0 && (
        <Dropdown
          label="Sort records"
          items={sortItems}
          trigger={
            <Button
              variant="outline"
              icon={<FiSliders />}
              collapseLabel
              trailing={selectedSort ? <span className="hidden text-xs text-muted-foreground sm:inline">{selectedSort.label}</span> : undefined}
            >
              Sort by
            </Button>
          }
        />
      )}
      <div className="flex flex-shrink-0 items-center gap-2">
        {onExport && (
          <Dropdown
            trigger={
              <Button
                variant="outline"
                isLoading={isExporting}
                loadingText="Exporting"
                icon={<FiDownload />}
                collapseLabel
              >
                Export
              </Button>
            }
            items={exportItems}
          />
        )}
        {actionButtons}
      </div>
      </div>
    </div>
  );
}
