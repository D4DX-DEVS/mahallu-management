import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { socialService, ActivityLog } from '@/services/socialService';
import { formatDate } from '@/utils/format';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';

export default function ActivityLogsList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [currentPage]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        page: currentPage,
        limit: itemsPerPage,
      };
      const result = await socialService.getActivityLogs(params);
      setLogs(Array.isArray(result.data) ? result.data : []);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch activity logs');
      console.error('Error fetching logs:', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      
      const params = { limit: 10000 };
      const result = await socialService.getActivityLogs(params);
      const dataToExport = Array.isArray(result.data) ? result.data : [];

      if (dataToExport.length === 0) {
        toast.info('No data to export');
        return;
      }

      const filename = 'activity-logs';
      const title = 'Activity Logs';

      switch (type) {
        case 'csv':
          exportToCSV(columns, dataToExport, filename);
          break;
        case 'json':
          exportToJSON(columns, dataToExport, filename);
          break;
        case 'pdf':
          exportToPDF(columns, dataToExport, filename, title);
          break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error?.response?.data?.message || 'Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<ActivityLog>[] = [
    {
      key: 'httpMethod',
      label: 'Method',
      render: (method) => {
        const methodColors: Record<string, string> = {
          GET: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
          POST: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
          PUT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
          PATCH: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
          DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        };
        return (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
            methodColors[method as string] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}>
            {method || 'UNKNOWN'}
          </span>
        );
      },
    },
    {
      key: 'statusCode',
      label: 'Status',
      render: (statusCode) => {
        if (!statusCode) return '-';
        const statusColors: Record<string, string> = {
          '2xx': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
          '3xx': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
          '4xx': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
          '5xx': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        };
        const statusRange = statusCode >= 200 && statusCode < 300 ? '2xx' :
                          statusCode >= 300 && statusCode < 400 ? '3xx' :
                          statusCode >= 400 && statusCode < 500 ? '4xx' :
                          statusCode >= 500 ? '5xx' : 'other';
        return (
          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
            statusColors[statusRange] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}>
            {statusCode}
          </span>
        );
      },
    },
    {
      key: 'action',
      label: 'Action',
      render: (action, row) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{action}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">on {row.entityType}</div>
        </div>
      ),
    },
    {
      key: 'endpoint',
      label: 'Endpoint',
      render: (endpoint) => (
        <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
          {endpoint || '-'}
        </span>
      ),
    },
    {
      key: 'userName',
      label: 'User',
      render: (userName) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">
          {userName || '-'}
        </span>
      ),
    },
    {
      key: 'ipAddress',
      label: 'IP Address',
      render: (ipAddress) => (
        <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
          {ipAddress || '-'}
        </span>
      ),
    },
    {
      key: 'details',
      label: 'Response Time',
      render: (details) => (
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {details?.responseTime || '-'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Timestamp',
      render: (date) => (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {formatDate(date)}
        </span>
      ),
    },
    {
      key: 'errorMessage',
      label: 'Error',
      render: (errorMessage) => {
        if (!errorMessage) return '-';
        return (
          <span className="text-xs text-red-600 dark:text-red-400" title={errorMessage}>
            {errorMessage.length > 30 ? `${errorMessage.substring(0, 30)}...` : errorMessage}
          </span>
        );
      },
    },
  ];

  if (error) {
    return (
      <div className="space-y-6">
        <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Activity Logs' }]} />
        <div className="text-center py-12">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Activity Logs' }]} />

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Activity Logs</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">View system activity logs</p>
      </div>

      <Card>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
          isFilterVisible={isFilterVisible}
          hasFilters={false}
          onRefresh={fetchLogs}
          onExport={handleExport}
          isExporting={isExporting}
        />

        <Table
          columns={columns}
          data={logs}
          isLoading={loading}
          emptyMessage="No activity logs found"
          showExport={false}
        />
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-6">
            <Pagination
              currentPage={currentPage}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </Card>
    </div>
  );
}

