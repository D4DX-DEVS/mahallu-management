import { ReactNode } from 'react';
import { FiFilter, FiRefreshCw, FiDownload, FiFileText, FiFile } from 'react-icons/fi';
import Button from './Button';
import ExpandableSearch from './ExpandableSearch';
import ActionBar from './ActionBar';
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
    /* One row at every width, one right-aligned cluster.
     *
     * Search used to sit in a `flex-1` group at the far left with Export and
     * the page's "+ New" button pinned to the far right, so on a wide screen
     * the search icon was a full table-width away from the button it belongs
     * with. Everything is now one cluster (see ActionBar): search, filter,
     * refresh, export, then the page's actions.
     *
     * Nothing wraps — the labelled controls collapse to their glyph below `sm`
     * (see `Button.collapseLabel`), which is what makes six controls fit across
     * 320px: 6 x 40px plus five 8px gaps is 280px, inside the 296px a 320px
     * phone leaves after the page's own gutters. Search is the one control that
     * gives up width when it opens. */
    <ActionBar className={cn('mb-4', className)}>
      {/* Search rests as an icon and opens into a field. The collapsed state
          is a real button with an accessible name, so it stays in the tab
          order; a query holds the field open so no filter is ever hidden. */}
      <ExpandableSearch value={searchQuery} onChange={onSearchChange} entity={searchEntity} />
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
    </ActionBar>
  );
}
