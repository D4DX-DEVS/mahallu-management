import { ReactNode } from 'react';
import { FiRefreshCw, FiDownload, FiFileText, FiFile } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Dropdown from '@/components/ui/Dropdown';
import FilterBar from '@/components/ui/FilterBar';

interface ListToolbarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  onRefresh?: () => void;
  onExport?: (type: 'csv' | 'json' | 'pdf') => void;
  isExporting?: boolean;
  /** Filter controls shown after the search box */
  children?: ReactNode;
}

/** FilterBar with the standard refresh + export actions used by the social list pages. */
export default function ListToolbar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Search',
  onRefresh,
  onExport,
  isExporting,
  children,
}: ListToolbarProps) {
  return (
    <FilterBar
      search={{ value: searchQuery, onChange: onSearchChange, placeholder: searchPlaceholder }}
      actions={
        <>
          {onRefresh && (
            <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={onRefresh}>
              <FiRefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
          {onExport && (
            <Dropdown
              trigger={
                <Button variant="secondary" isLoading={isExporting}>
                  {!isExporting && <FiDownload className="h-3.5 w-3.5" />}
                  Export
                </Button>
              }
              items={[
                { label: 'Export CSV', icon: <FiFileText />, onClick: () => onExport('csv'), disabled: isExporting },
                { label: 'Export JSON', icon: <FiFile />, onClick: () => onExport('json'), disabled: isExporting },
                { label: 'Export PDF', icon: <FiDownload />, onClick: () => onExport('pdf'), disabled: isExporting },
              ]}
            />
          )}
        </>
      }
    >
      {children}
    </FilterBar>
  );
}
