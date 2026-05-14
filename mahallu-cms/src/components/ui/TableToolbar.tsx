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
            variant={isFilterVisible ? 'primary' : 'outline'}
            size="sm"
            onClick={onFilterClick}
            className="flex items-center gap-1.5"
          >
            <FiFilter className="h-3.5 w-3.5" />
            Filter
          </Button>
        )}

        {/* Refresh Button */}
        {onRefresh && (
          <Button variant="outline" size="sm" onClick={onRefresh} className="px-2.5">
            <FiRefreshCw className="h-3.5 w-3.5" />
          </Button>
        )}

        {/* Search */}
        <div className={cn(
          "relative flex h-9 items-center overflow-hidden rounded-lg border border-gray-200 bg-white transition-all duration-300 ease-in-out dark:border-gray-700 dark:bg-gray-800",
          isSearchExpanded ? "w-56" : "w-9 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
        )} onClick={!isSearchExpanded ? handleSearchClick : undefined}>
          <div className="flex h-full w-9 flex-shrink-0 items-center justify-center text-gray-500 dark:text-gray-400">
            <FiSearch className="h-3.5 w-3.5" />
          </div>
          
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onBlur={handleSearchBlur}
            placeholder="Search"
            className={cn(
              "h-full w-full border-none bg-transparent pr-8 text-[0.82rem] text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-0 dark:text-gray-100",
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
              className="absolute right-3 flex items-center text-gray-400 hover:text-gray-600"
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
              <Button variant="outline" size="sm" isLoading={isExporting}>
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

