import { useState, useEffect } from 'react';
import EmptyState from '@/components/ui/EmptyState';
import TableCard from '@/components/ui/TableCard';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { socialService, ActivityLog } from '@/services/socialService';
import { fetchAllPages } from '@/services/api';
import { formatDate } from '@/utils/format';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import { logError } from '@/utils/safeLog';

export default function ActivityLogsList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchLogs();
  }, [currentPage, itemsPerPage]);

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
      setError(loadErrorMessage(err, 'activity logs'));
      logError('Error fetching logs', err);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);

      const dataToExport = await fetchAllPages<ActivityLog>(({ page, limit }) =>
        socialService.getActivityLogs({ page, limit })
      );

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
          await exportToPDF(columns, dataToExport, filename, title);
          break;
      }
    } catch (error: any) {
      logError('Export error', error);
      toast.error(errorMessage(error, { action: 'export data' }));
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<ActivityLog>[] = [
    {
      key: 'httpMethod',
      label: 'Method',
      width: '8rem',
      render: (method) => {
        const methodColors: Record<string, string> = {
          GET: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
          POST: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
          PUT: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
          PATCH: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
          DELETE: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        };
        return (
          <span
            className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold ${
              methodColors[method as string] ||
              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
          >
            {method || 'UNKNOWN'}
          </span>
        );
      },
    },
    {
      key: 'statusCode',
      label: 'Status',
      width: '8rem',
      render: (statusCode) => {
        if (!statusCode) return '-';
        const statusRange =
          statusCode >= 200 && statusCode < 300
            ? '2xx'
            : statusCode >= 300 && statusCode < 400
              ? '3xx'
              : statusCode >= 400 && statusCode < 500
                ? '4xx'
                : statusCode >= 500
                  ? '5xx'
                  : 'other';
        return <StatusBadge status={statusRange} />;
      },
    },
    {
      key: 'action',
      label: 'Action',
      width: '16rem',
      render: (action, row) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-gray-100">{action}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">on {row.entityType}</div>
        </div>
      ),
    },
    {
      key: 'endpoint', priority: 'secondary',
      label: 'Endpoint',
      width: '16rem',
      render: (endpoint) => (
        <span className="font-mono text-xs text-gray-600 dark:text-gray-400">{endpoint || '-'}</span>
      ),
    },
    {
      key: 'userName', priority: 'secondary',
      label: 'User',
      width: '10rem',
      render: (userName) => (
        <span className="text-sm text-gray-900 dark:text-gray-100">{userName ? toTitleCase(userName) : '-'}</span>
      ),
    },
    {
      key: 'ipAddress', priority: 'tertiary',
      label: 'IP Address',
      width: '10rem',
      render: (ipAddress) => (
        <span className="font-mono text-xs text-gray-600 dark:text-gray-400">{ipAddress || '-'}</span>
      ),
    },
    {
      key: 'details', priority: 'tertiary',
      label: 'Response Time',
      width: '10rem',
      render: (details) => (
        <span className="text-xs text-gray-600 dark:text-gray-400">{details?.responseTime || '-'}</span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Timestamp',
      width: '10rem',
      render: (date) => <span className="text-sm text-gray-600 dark:text-gray-400">{formatDate(date)}</span>,
    },
    {
      key: 'errorMessage', priority: 'tertiary',
      label: 'Error',
      width: '12rem',
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
      <div className="space-y-4">
        <PageHeader description="View system activity logs" title="Activity Logs" />
        <div className="text-center py-10">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

  // The API has no log search, so this narrows the page already loaded.
  const needle = searchQuery.trim().toLowerCase();
  const visibleLogs = needle
    ? logs.filter((log) =>
        [log.action, log.entityType, log.endpoint, log.userName].some((value) =>
          String(value ?? '').toLowerCase().includes(needle)
        )
      )
    : logs;

  const isFiltered = Boolean(searchQuery);

  return (
    <>
      <PageHeader
        title="Activity logs"
        description="Who did what, and when."
      />

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchEntity="activity logs"
          onRefresh={fetchLogs}
          onExport={handleExport}
          isExporting={isExporting}
        />

        {error ? (
          <EmptyState
            variant="error"
            entity="activity logs"
            description={error}
            action={{ label: 'Try again', onClick: fetchLogs }}
          />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={visibleLogs}
              isLoading={loading}
              entity="activity logs"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={isFiltered ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); } } : undefined}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="activity logs"
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(size) => {
                    setItemsPerPage(size);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
          </>
        )}
      </TableCard>
    </>
  );
}
