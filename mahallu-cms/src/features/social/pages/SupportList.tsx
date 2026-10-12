import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiHelpCircle, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import StatusBadge from '@/components/ui/StatusBadge';
import RowActions from '@/components/ui/RowActions';
import ListToolbar from '../components/ListToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { socialService, Support } from '@/services/socialService';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { monthlySeries, shareViz, waitingViz } from '@/utils/statSeries';

export default function SupportList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [support, setSupport] = useState<Support[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchSupport();
  }, [statusFilter, priorityFilter, currentPage]);

  const fetchSupport = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
      };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (priorityFilter !== 'all') {
        params.priority = priorityFilter;
      }
      const result = await socialService.getAllSupport(params);
      setSupport(Array.isArray(result.data) ? result.data : []);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load support tickets. Refresh the page or try again."));
      console.error('Error fetching support:', err);
      setSupport([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      
      const params: any = { limit: 10000 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (priorityFilter !== 'all') params.priority = priorityFilter;
      
      const result = await socialService.getAllSupport(params);
      const dataToExport = Array.isArray(result.data) ? result.data : [];

      if (dataToExport.length === 0) {
        toast.info('Nothing to export. Change your filters and try again.');
        return;
      }

      const filename = 'support-tickets';
      const title = 'Support Tickets';

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

  const columns: TableColumn<Support>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'subject', label: 'Subject', sortable: true },
    {
      key: 'priority',
      label: 'Priority',
      render: (priority) => {
        const tones: Record<string, 'info' | 'warning' | 'danger'> = { low: 'info', medium: 'warning', high: 'danger' };
        const value: string = priority || 'medium';
        return (
          <Badge variant={tones[value] || 'neutral'} dot>
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </Badge>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (status) => <StatusBadge status={status || 'open'} />,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (date) => formatDate(date),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <RowActions
          onView={() => navigate(`/social/support/${row.id}`)}
          viewLabel="View ticket"
          ariaLabels={{ view: 'View ticket' }}
        />
      ),
    },
  ];

  const stats = [
    { title: 'Total Tickets', value: support.length, viz: monthlySeries(support as any[], (r: any) => r.createdAt).length ? { type: 'bars' as const, values: monthlySeries(support as any[], (r: any) => r.createdAt) } : undefined, icon: <FiHelpCircle className="h-[17px] w-[17px]" />, tone: 'green' as const },
    {
      title: 'Open',
      value: support.filter((s) => s.status === 'open' || !s.status).length, viz: waitingViz(support.filter((s) => s.status === 'open' || !s.status).length), summary: `Open: ${support.filter((s) => s.status === 'open' || !s.status).length} of ${support.length}`,
      icon: <FiAlertCircle className="h-[17px] w-[17px]" />,
      tone: 'gold' as const,
    },
    {
      title: 'Resolved',
      value: support.filter((s) => s.status === 'resolved').length, viz: shareViz(support.filter((s) => s.status === 'resolved').length, support.length), summary: `Resolved: ${support.filter((s) => s.status === 'resolved').length} of ${support.length}`,
      icon: <FiCheckCircle className="h-[17px] w-[17px]" />,
      tone: 'lime' as const,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Support tickets"
        description="Manage support tickets"
        actions={
          <Link to="/social/support/create">
            <Button>+ New ticket</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard key={index} variant="inline" {...stat} />
        ))}
      </div>

      <Card padding="none" className="overflow-visible">
        <ListToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search tickets"
          onRefresh={fetchSupport}
          onExport={handleExport}
          isExporting={isExporting}
        >
          <div className="w-40">
            <Select
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'open', label: 'Open' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'resolved', label: 'Resolved' },
                { value: 'closed', label: 'Closed' },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
          <div className="w-40">
            <Select
              options={[
                { value: 'all', label: 'All Priority' },
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
              ]}
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            />
          </div>
        </ListToolbar>

        <div className="p-3.5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <Button onClick={fetchSupport} className="mt-4" variant="outline">
                Retry
              </Button>
            </div>
          ) : (
            <>
              <Table columns={columns} data={support} emptyMessage="No support tickets found" showExport={false} />
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
            </>
          )}
        </div>
      </Card>
    </div>
  );
}

