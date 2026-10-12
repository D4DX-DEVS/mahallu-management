import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import { PersonCell } from '@/components/ui/Avatar';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import Alert from '@/components/ui/Alert';
import ListToolbar from '../components/ListToolbar';
import { socialService, ActivityLog } from '@/services/socialService';
import { formatDate } from '@/utils/format';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

export default function ActivityLogsList() {
  const [searchQuery, setSearchQuery] = useState('');
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
      setError(getFriendlyError(err, "Couldn't load activity logs. Refresh the page or try again."));
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
        toast.info('Nothing to export. Change your filters and try again.');
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
      toast.error(getFriendlyError(error, "Couldn't export data. Check your connection and try again."));
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<ActivityLog>[] = [
    {
      key: 'httpMethod',
      label: 'Method',
      render: (method) => {
        const methodTones: Record<string, 'info' | 'success' | 'warning' | 'danger'> = {
          GET: 'info',
          POST: 'success',
          PUT: 'warning',
          PATCH: 'warning',
          DELETE: 'danger',
        };
        return <Badge variant={methodTones[method as string] || 'neutral'}>{method || 'UNKNOWN'}</Badge>;
      },
    },
    {
      key: 'statusCode',
      label: 'Status',
      render: (statusCode) => {
        if (!statusCode) return '-';
        const tone =
          statusCode >= 200 && statusCode < 300 ? 'success' :
          statusCode >= 300 && statusCode < 400 ? 'info' :
          statusCode >= 400 && statusCode < 500 ? 'warning' :
          statusCode >= 500 ? 'danger' : 'neutral';
        return <Badge variant={tone}>{statusCode}</Badge>;
      },
    },
    {
      key: 'action',
      label: 'Action',
      render: (action, row) => (
        <div>
          <div className="font-medium text-[#18231E] dark:text-surface-text">{action}</div>
          <div className="text-xs text-[#7B8983] dark:text-surface-muted">on {row.entityType}</div>
        </div>
      ),
    },
    {
      key: 'endpoint',
      label: 'Endpoint',
      render: (endpoint) => (
        <span className="font-mono text-xs text-[#5B6963] dark:text-surface-muted">
          {endpoint || '-'}
        </span>
      ),
    },
    {
      key: 'userName',
      label: 'User',
      render: (userName) => (
        userName ? <PersonCell name={userName} size={24} /> : <span className="text-sm text-[#18231E] dark:text-surface-text">-</span>
      ),
    },
    {
      key: 'ipAddress',
      label: 'IP Address',
      render: (ipAddress) => (
        <span className="font-mono text-xs text-[#5B6963] dark:text-surface-muted">
          {ipAddress || '-'}
        </span>
      ),
    },
    {
      key: 'details',
      label: 'Response Time',
      render: (details) => (
        <span className="text-xs text-[#5B6963] dark:text-surface-muted">
          {details?.responseTime || '-'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Timestamp',
      render: (date) => (
        <span className="text-sm text-[#5B6963] dark:text-surface-muted">
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
      <div className="space-y-4">
        <PageHeader title="Activity logs" description="View system activity logs" />
        <Alert tone="danger">{error}</Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Activity logs" description="View system activity logs" />

      <Card padding="none" className="overflow-visible">
        <ListToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search logs"
          onRefresh={fetchLogs}
          onExport={handleExport}
          isExporting={isExporting}
        />

        <div className="p-3.5">
          <Table
            columns={columns}
            data={logs}
            isLoading={loading}
            emptyMessage="No activity logs found"
            showExport={false}
          />
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-3.5">
              <Pagination
                currentPage={currentPage}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
