import { ReactNode } from 'react';
import { FiFilter, FiRefreshCw, FiDownload, FiFileText, FiFile } from 'react-icons/fi';
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
  actionButtons?: ReactNode;
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
  className,
}: TableToolbarProps) {
  const exportItems: DropdownItem[] = [
    { label: 'Export as CSV', icon: <FiFileText />, onClick: () => onExport?.('csv'), disabled: isExporting },
    { label: 'Export as PDF', icon: <FiFile />, onClick: () => onExport?.('pdf'), disabled: isExporting },
  ];
  return (
    <div
      className={cn(
        'mb-4 flex flex-col items-stretch justify-between gap-2 sm:flex-row sm:items-center',
        className
      )}
    >
      <div className="flex flex-1 items-center gap-2">
        {/* Search rests as an icon and opens into a field. The collapsed state
            is a real button with an accessible name, so it stays in the tab
            order; a query holds the field open so no filter is ever hidden. */}
        <ExpandableSearch
          value={searchQuery}
          onChange={onSearchChange}
          entity={searchEntity}
        />
        {hasFilters && onFilterClick && (
          <Button
            variant="outline"
            onClick={onFilterClick}
            aria-expanded={isFilterVisible}
            className="flex-shrink-0"
          >
            <FiFilter className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Filter</span>
            {activeFilterCount > 0 && (
              <Badge variant="primary" className="ml-1">
                {activeFilterCount}
              </Badge>
            )}
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
      <div className="flex items-center gap-2">
        {onExport && (
          <Dropdown
            trigger={
              <Button variant="outline" isLoading={isExporting} loadingText="Exporting">
                <FiDownload className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Export</span>
              </Button>
            }
            items={exportItems}
          />
        )}
        {actionButtons}
      </div>
    </div>
  );
}
