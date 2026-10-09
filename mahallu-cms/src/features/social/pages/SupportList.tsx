import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiAlertCircle, FiCheckCircle, FiHelpCircle, FiPlus } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import FilterPanel from '@/components/ui/FilterPanel';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { socialService, Support } from '@/services/socialService';
import { fetchAllPages } from '@/services/api';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { ROUTES } from '@/constants/routes';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';
import { useServerCounts } from '@/hooks/useServerCounts';
import { logError } from '@/utils/safeLog';

export default function SupportList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [support, setSupport] = useState<Support[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchSupport();
  }, [statusFilter, priorityFilter, currentPage, itemsPerPage]);

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
      setError(loadErrorMessage(err, 'support tickets'));
      logError('Error fetching support', err);
      setSupport([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);

      const filters: any = {};
      if (statusFilter !== 'all') filters.status = statusFilter;
      if (priorityFilter !== 'all') filters.priority = priorityFilter;

      const dataToExport = await fetchAllPages<Support>(({ page, limit }) =>
        socialService.getAllSupport({ ...filters, page, limit })
      );

      if (dataToExport.length === 0) {
        toast.info('No data to export');
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

  const columns: TableColumn<Support>[] = [
    {
      key: 'subject',
      label: 'Subject',
      width: '20rem',
      sortable: true,
      render: (subject) => <span className="font-medium text-foreground">{subject}</span>,
    },
    {
      key: 'priority', sortable: true,
      label: 'Priority',
      width: '8rem',
      render: (priority) => {
        const priorityColors: Record<string, string> = {
          low: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
          medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
          high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        };
        return (
          <span
            className={`px-2 py-1 text-xs font-medium rounded-full ${priorityColors[priority || 'medium']}`}
          >
            {priority || 'medium'}
          </span>
        );
      },
    },
    {
      key: 'status', sortable: true,
      label: 'Status',
      width: '8rem',
      render: (status) => {
        return <StatusBadge status={status} />;
      },
    },
    {
      key: 'createdAt', sortable: true, priority: 'secondary',
      label: 'Created',
      width: '9rem',
      render: (date) => formatDate(date),
    },
  ];

  // Whole-list counts from the server: these cards used to count only the rows on this page.
  const countBase = priorityFilter !== 'all' ? { priority: priorityFilter } : {};
  const statusCounts = useServerCounts(
    {
      open: () => socialService.getAllSupport({ ...countBase, status: 'open', page: 1, limit: 1 }),
      resolved: () => socialService.getAllSupport({ ...countBase, status: 'resolved', page: 1, limit: 1 }),
    },
    [support]
  );

  const stats = [
    { title: 'Total Tickets', value: pagination?.total ?? support.length, icon: <FiHelpCircle className="h-5 w-5" /> },
    {
      title: 'Open',
      value: statusCounts.open ?? support.filter((s) => s.status === 'open' || !s.status).length,
      icon: <FiAlertCircle className="h-5 w-5" />,
    },
    {
      title: 'Resolved',
      value: statusCounts.resolved ?? support.filter((s) => s.status === 'resolved').length,
      icon: <FiCheckCircle className="h-5 w-5" />,
    },
  ];

  // The API has no ticket search, so this narrows the page already loaded.
  const visibleTickets = support.filter((ticket) =>
    (ticket.subject || '').toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (priorityFilter !== 'all' ? 1 : 0);
  const isFiltered = Boolean(searchQuery) || activeFilterCount > 0;

  return (
    <>
      <PageHeader
        title="Support tickets"
        description="Manage support tickets."
        actions={
          <Link to={ROUTES.SOCIAL.CREATE_SUPPORT}>
            <Button icon={<FiPlus />} collapseLabel>New ticket</Button>
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchEntity="support tickets"
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={activeFilterCount}
          onRefresh={fetchSupport}
          onExport={handleExport}
          isExporting={isExporting}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-52">
              <Select
                label="Status"
                options={[
                  { value: 'all', label: 'All statuses' },
                  { value: 'open', label: 'Open' },
                  { value: 'in_progress', label: 'In progress' },
                  { value: 'resolved', label: 'Resolved' },
                  { value: 'closed', label: 'Closed' },
                ]}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="w-full sm:w-52">
              <Select
                label="Priority"
                options={[
                  { value: 'all', label: 'All priorities' },
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                ]}
                value={priorityFilter}
                onChange={(e) => {
                  setPriorityFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                onClick={() => {
                  setStatusFilter('all');
                  setPriorityFilter('all');
                  setCurrentPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterPanel>
        )}

        {error ? (
          <EmptyState
            variant="error"
            entity="support tickets"
            description={error}
            action={{ label: 'Try again', onClick: fetchSupport }}
          />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={visibleTickets}
              isLoading={loading}
              entity="support tickets"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); setStatusFilter('all'); setPriorityFilter('all'); setCurrentPage(1); } }
                  : { label: 'Add ticket', onClick: () => navigate(ROUTES.SOCIAL.CREATE_SUPPORT) }
              }
              onRowClick={(row) => navigate(ROUTES.SOCIAL.SUPPORT_DETAIL(row.id))}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="support tickets"
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
