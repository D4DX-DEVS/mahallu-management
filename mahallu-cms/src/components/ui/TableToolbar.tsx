import { useState, useRef, useEffect, ReactNode } from 'react';
import { FiFilter, FiSearch, FiRefreshCw, FiDownload, FiX, FiFileText, FiFile } from 'react-icons/fi';
import Button from './Button';
import Dropdown, { DropdownItem } from './Dropdown';
import { cn } from '@/utils/cn';

interface TableToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onFilterClick?: () => void;
  isFilterVisible?: boolean;
  hasFilters?: boolean; // Show filter button only if filters exist
  onRefresh?: () => void;
  onExport?: (type: 'csv' | 'json' | 'pdf') => void;
  actionButtons?: ReactNode;
  className?: string;
  isExporting?: boolean;
}

export default function TableToolbar({
  searchQuery,
  onSearchChange,
  onFilterClick,
  isFilterVisible = false,
  hasFilters = false,
  onRefresh,
  onExport,
  actionButtons,
  className,
  isExporting,
}: TableToolbarProps) {
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isSearchExpanded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchExpanded]);

  const handleSearchClick = () => {
    setIsSearchExpanded(true);
  };

  const handleSearchBlur = () => {
    if (!searchQuery) {
      setIsSearchExpanded(false);
    }
  };

  const handleClearSearch = () => {
    onSearchChange('');
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }
  };

  const exportItems: DropdownItem[] = [
    {
      label: 'Export CSV',
      icon: <FiFileText />,
      onClick: () => onExport?.('csv'),
      disabled: isExporting,
    },
    {
      label: 'Export JSON',
      icon: <FiFile />,
      onClick: () => onExport?.('json'),
      disabled: isExporting,
    },
    {
      label: 'Export PDF',
      icon: <FiDownload />,
      onClick: () => onExport?.('pdf'),
      disabled: isExporting,
    },
  ];

  return (
    <div className={cn('mb-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center', className)}>
      <div className="flex flex-1 items-center gap-1.5">
        {/* Filter Toggle - Only show if filters exist */}
        {hasFilters && onFilterClick && (
          <Button
            variant={isFilterVisible ? 'soft' : 'secondary'}
            size="md"
            onClick={onFilterClick}
            className="flex items-center gap-1.5"
          >
            <FiFilter className="h-3.5 w-3.5" />
            Filter
          </Button>
        )}

        {/* Refresh Button */}
        {onRefresh && (
          <Button variant="secondary" size="md" onClick={onRefresh} className="w-[34px] px-0" aria-label="Refresh">
            <FiRefreshCw className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* Search */}
        <div className={cn(
          "relative flex h-[34px] items-center overflow-hidden rounded-lg border border-line-strong bg-white transition-all duration-300 ease-in-out dark:border-surface-border-strong dark:bg-surface-raised",
          isSearchExpanded ? "w-60 border-primary-600 shadow-focus" : "w-[34px] cursor-pointer hover:bg-[#F4F7F5] dark:hover:bg-surface-hover"
        )} onClick={!isSearchExpanded ? handleSearchClick : undefined}>
          <div className="flex h-full w-[34px] flex-shrink-0 items-center justify-center text-[#5B6963] dark:text-surface-muted">
            <FiSearch className="h-3.5 w-3.5" aria-hidden="true" />
          </div>
          
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onBlur={handleSearchBlur}
            placeholder="Search"
            aria-label="Search"
            className={cn(
              "h-full w-full border-none bg-transparent pr-8 text-xs text-[#18231E] placeholder-[#7B8983] focus:outline-none focus:ring-0 dark:text-surface-text",
              !isSearchExpanded && "pointer-events-none opacity-0"
            )}
            tabIndex={isSearchExpanded ? 0 : -1}
          />
          
          {searchQuery && isSearchExpanded && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                handleClearSearch();
              }}
              aria-label="Clear search"
              className="absolute right-3 flex items-center text-[#98A59F] hover:text-[#3A4741]"
            >
              <FiX className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5">
         {/* Export Dropdown */}
        {onExport && (
          <Dropdown
            trigger={
              <Button variant="secondary" size="md" isLoading={isExporting}>
                {!isExporting && <FiDownload className="h-3.5 w-3.5 sm:mr-1.5" />}
                <span className="hidden sm:inline">Export</span>
              </Button>
            }
            items={exportItems}
          />
        )}
        
        {/* Action Buttons */}
        {actionButtons}
      </div>
    </div>
  );
}

