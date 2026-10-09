import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiClock, FiFileText, FiPlus } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import FilterPanel from '@/components/ui/FilterPanel';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { toast } from '@/store/toastStore';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { registrationService, NikahRegistration } from '@/services/registrationService';
import { fetchAllPages } from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate, toTitleCase } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';
import { useServerCounts } from '@/hooks/useServerCounts';
import { logError } from '@/utils/safeLog';

export default function NikahRegistrationsList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [registrations, setRegistrations] = useState<NikahRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchRegistrations();
  }, [debouncedSearch, statusFilter, currentPage, itemsPerPage]);

  const fetchRegistrations = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
      };
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      const result = await registrationService.getAllNikah(params);
      setRegistrations(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(loadErrorMessage(err, 'nikah registrations'));
      logError('Error fetching registrations', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);

      const filters: any = {};
      if (debouncedSearch) filters.search = debouncedSearch;
      if (statusFilter !== 'all') filters.status = statusFilter;

      // The list endpoint caps a page at 100 and answers 400 above it, so the
      // old single `limit: 10000` export call failed for any non-empty result.
      const dataToExport = await fetchAllPages<NikahRegistration>((params) =>
        registrationService.getAllNikah({ ...filters, ...params })
      );

      if (dataToExport.length === 0) {
        toast.info('No nikah registrations to export');
        return;
      }

      const filename = 'nikah-registrations';
      const title = 'Nikah Registrations';

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
      toast.error(errorMessage(error, { action: 'export nikah registrations' }));
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<NikahRegistration>[] = [
    {
      key: 'groomName',
      label: 'Groom',
      width: '14rem',
      sortable: true,
      render: (name) => <span className="font-medium text-foreground">{toTitleCase(name)}</span>,
    },
    {
      key: 'brideName',
      label: 'Bride',
      width: '14rem',
      sortable: true,
      render: (name) => toTitleCase(name),
    },
    {
      key: 'nikahDate',
      label: 'Nikah date',
      sortable: true,
      width: '9rem',
      render: (date) => formatDate(date),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      width: '9rem',
      render: (status) => <StatusBadge status={status} />,
    },
  ];

  // Whole-list counts from the server: these cards used to count only the rows on this page.
  const countBase = debouncedSearch ? { search: debouncedSearch } : {};
  const statusCounts = useServerCounts(
    {
      pending: () => registrationService.getAllNikah({ ...countBase, status: 'pending', page: 1, limit: 1 }),
      approved: () => registrationService.getAllNikah({ ...countBase, status: 'approved', page: 1, limit: 1 }),
    },
    [registrations]
  );

  const stats = [
    {
      title: 'Total Registrations',
      value: pagination?.total || registrations.length,
      icon: <FiFileText className="h-5 w-5" />,
    },
    {
      title: 'Pending',
      value: statusCounts.pending ?? registrations.filter((r) => r.status === 'pending' || !r.status).length,
      icon: <FiClock className="h-5 w-5" />,
    },
    {
      title: 'Approved',
      value: statusCounts.approved ?? registrations.filter((r) => r.status === 'approved').length,
      icon: <FiCheckCircle className="h-5 w-5" />,
    },
  ];

  const isFiltered = Boolean(debouncedSearch) || statusFilter !== 'all';

  return (
    <>
      <PageHeader
        title="Nikah registrations"
        description="Manage nikah registrations."
        actions={
          <Link to="/registrations/nikah/create">
            <Button icon={<FiPlus />} collapseLabel>New registration</Button>
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
          searchEntity="nikah registrations"
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={statusFilter !== 'all' ? 1 : 0}
          onRefresh={fetchRegistrations}
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
                  { value: 'pending', label: 'Pending' },
                  { value: 'correction_required', label: 'Correction required' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' },
                ]}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            {statusFilter !== 'all' && (
              <Button
                variant="ghost"
                onClick={() => {
                  setStatusFilter('all');
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
            entity="nikah registrations"
            description={error}
            action={{ label: 'Try again', onClick: fetchRegistrations }}
          />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={registrations}
              isLoading={loading}
              entity="nikah registrations"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); setStatusFilter('all'); setCurrentPage(1); } }
                  : { label: 'Add registration', onClick: () => navigate('/registrations/nikah/create') }
              }
              onRowClick={(row) => navigate(`/registrations/nikah/${row.id}`)}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="nikah registrations"
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
