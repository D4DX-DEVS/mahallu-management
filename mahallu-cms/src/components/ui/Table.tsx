import { useState } from 'react';
import { TableColumn } from '@/types';
import { cn } from '@/utils/cn';
import LoadingSpinner from './LoadingSpinner';
import EmptyState from './EmptyState';
import Button from './Button';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { FiFileText, FiFile, FiDownload } from 'react-icons/fi';

export interface TableProps<T = any> {
  columns: TableColumn<T>[];
  data: T[];
  isLoading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  className?: string;
  exportFilename?: string;
  exportTitle?: string;
  showExport?: boolean;
  /**
   * Function to fetch all filtered data for export.
   * Should return a Promise that resolves to an array of all filtered data.
   * If not provided, exports will use the current page data.
   */
  onExportAll?: () => Promise<T[]>;
}

function Table<T extends Record<string, any>>({
  columns,
  data,
  isLoading = false,
  emptyMessage = 'No data available',
  onRowClick,
  className,
  exportFilename = 'export',
  exportTitle,
  showExport = true,
  onExportAll,
}: TableProps<T>) {
  const [exporting, setExporting] = useState(false);
  const [exportType, setExportType] = useState<'csv' | 'json' | 'pdf' | null>(null);

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setExporting(true);
      setExportType(type);
      
      // If onExportAll is provided, fetch all filtered data, otherwise use current page data
      const dataToExport = onExportAll ? await onExportAll() : data;
      
      if (dataToExport.length === 0) {
        alert('No data to export');
        return;
      }

      switch (type) {
        case 'csv':
          exportToCSV(columns, dataToExport, exportFilename);
          break;
        case 'json':
          exportToJSON(columns, dataToExport, exportFilename);
          break;
        case 'pdf':
          exportToPDF(columns, dataToExport, exportFilename, exportTitle);
          break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      alert(error?.message || 'Failed to export data. Please try again.');
    } finally {
      setExporting(false);
      setExportType(null);
    }
  };

  const handleExportCSV = () => handleExport('csv');
  const handleExportJSON = () => handleExport('json');
  const handleExportPDF = () => handleExport('pdf');

  if (isLoading) {
    return <LoadingSpinner size="lg" className="py-12" />;
  }

  if (data.length === 0) {
    return <EmptyState title={emptyMessage} />;
  }

  return (
    <div className={cn('space-y-3', className)}>
      {showExport && data.length > 0 && (
        <div className="flex items-center justify-end gap-2 border-b border-gray-200 pb-2 dark:border-gray-700">
          <span className="mr-2 text-xs text-gray-600 dark:text-gray-400">Export:</span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={exporting}
            isLoading={exporting && exportType === 'csv'}
            className="flex items-center gap-2"
          >
            <FiFileText className="h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportJSON}
            disabled={exporting}
            isLoading={exporting && exportType === 'json'}
            className="flex items-center gap-2"
          >
            <FiFile className="h-4 w-4" />
            JSON
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPDF}
            disabled={exporting}
            isLoading={exporting && exportType === 'pdf'}
            className="flex items-center gap-2"
          >
            <FiDownload className="h-4 w-4" />
            PDF
          </Button>
        </div>
      )}
      <div className="overflow-x-auto overflow-y-visible">
        <table className="w-full border-collapse">
        <thead className="bg-gray-50/50 dark:bg-gray-800/50">
          <tr className="border-b border-gray-200 dark:border-gray-700">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-3 py-2.5 text-left text-[0.64rem] font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-gray-400"
                >
                  <div className="flex items-center gap-2">
                    {column.label}
                    {column.sortable && (
                      <span className="text-gray-400">↕</span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                onClick={() => onRowClick?.(row)}
                className={cn(
                  'hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors',
                  onRowClick && 'cursor-pointer'
                )}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className="px-3 py-2.5 text-[0.82rem] text-gray-900 dark:text-gray-100"
                  >
                    {column.render
                      ? column.render(row[column.key], row, rowIndex)
                      : row[column.key] ?? '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Table;

