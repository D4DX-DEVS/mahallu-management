import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiClock, FiEdit2, FiEye, FiFileText, FiPlus } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import FilterPanel from '@/components/ui/FilterPanel';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { toast } from '@/store/toastStore';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { registrationService, DeathRegistration } from '@/services/registrationService';
import { fetchAllPages } from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate, toTitleCase } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';
import ActionsMenu from '@/components/ui/ActionsMenu';

export default function DeathRegistrationsList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [registrations, setRegistrations] = useState<DeathRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchRegistrations();
  }, [debouncedSearch, statusFilter, currentPage]);

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
      const result = await registrationService.getAllDeath(params);
      setRegistrations(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(loadErrorMessage(err, 'death registrations'));
      console.error('Error fetching registrations:', err);
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
      const dataToExport = await fetchAllPages<DeathRegistration>((params) =>
        registrationService.getAllDeath({ ...filters, ...params })
      );

      if (dataToExport.length === 0) {
        toast.info('No death registrations to export');
        return;
      }

      const filename = 'death-registrations';
      const title = 'Death Registrations';

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
      toast.error(errorMessage(error, { action: 'export death registrations' }));
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<DeathRegistration>[] = [
    {
      key: 'deceasedName',
      label: 'Deceased Name',
      width: '11.25rem',
      sortable: true,
      render: (name) => toTitleCase(name),
    },
    {
      key: 'deathDate',
      label: 'Death Date',
      width: '9.5rem',
      render: (date) => formatDate(date),
    },
    { key: 'placeOfDeath', label: 'Place', width: '6.5rem', render: (place) => toTitleCase(place) },
    {
      key: 'status',
      label: 'Status',
      width: '7.25rem',
      render: (status) => {
        return <StatusBadge status={status} />;
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '8rem',
      align: 'center',
      render: (_, row) => (
        <ActionsMenu
          items={[
            {
              label: 'View',
              icon: <FiEye className="h-4 w-4" />,
              onClick: () => {
                navigate(`/registrations/death/${row.id}`);
              },
            },
            {
              label: 'Edit',
              icon: <FiEdit2 className="h-4 w-4" />,
              onClick: () => {
                navigate(`/registrations/death/${row.id}/edit`);
              },
            },
          ]}
        />
      ),
    },
  ];

  const stats = [
    {
      title: 'Total Registrations',
      value: pagination?.total || registrations.length,
      icon: <FiFileText className="h-5 w-5" />,
    },
    {
      title: 'Pending',
      value: registrations.filter((r) => r.status === 'pending' || !r.status).length,
      icon: <FiClock className="h-5 w-5" />,
    },
    {
      title: 'Approved',
      value: registrations.filter((r) => r.status === 'approved').length,
      icon: <FiCheckCircle className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <PageHeader title="Death Registrations" description="Manage death registrations" />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
          isFilterVisible={isFilterVisible}
          hasFilters={true}
          onRefresh={fetchRegistrations}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={
            <Link to="/registrations/death/create">
              <Button size="md" icon={<FiPlus />} collapseLabel>New Registration</Button>
            </Link>
          }
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-40">
              <Select
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'correction_required', label: 'Correction Required' },
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
          </FilterPanel>
        )}

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchRegistrations} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <Table
            fixedLayout
            striped
            columns={columns}
            data={registrations}
            emptyMessage="No death registrations found"
            showExport={false}
            onRowClick={(row) => navigate(`/registrations/death/${row.id}`)}
          />
        )}

        {/* Pagination */}
        {pagination && (
          <div className="mt-4">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={(page) => {
                setCurrentPage(page);
              }}
            />
          </div>
        )}
      </TableCard>
    </div>
  );
}
