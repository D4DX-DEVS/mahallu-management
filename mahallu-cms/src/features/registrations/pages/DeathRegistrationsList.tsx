import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEye, FiEdit2, FiX, FiFileText, FiClock, FiCheckCircle } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
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
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';

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
      setError(err.response?.data?.message || 'Failed to fetch death registrations');
      console.error('Error fetching registrations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      
      const params: any = { limit: 10000 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter !== 'all') params.status = statusFilter;
      
      const result = await registrationService.getAllDeath(params);
      const dataToExport = result.data;

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
      console.error('Export error:', error);
      toast.error(error?.message || 'Failed to export death registrations');
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<DeathRegistration>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'deceasedName', label: 'Deceased Name', sortable: true },
    {
      key: 'deathDate',
      label: 'Death Date',
      render: (date) => formatDate(date),
    },
    { key: 'placeOfDeath', label: 'Place' },
    {
      key: 'status',
      label: 'Status',
      render: (status) => {
        const statusColors: Record<string, string> = {
          pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
          approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
          rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        };
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status || 'pending']}`}>
            {status || 'pending'}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/registrations/death/${row.id}`);
            }}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            title="View"
          >
            <FiEye className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/registrations/death/${row.id}/edit`);
            }}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-blue-600 dark:text-blue-400 transition-colors"
            title="Edit"
          >
            <FiEdit2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const stats = [
    { title: 'Total Registrations', value: pagination?.total || registrations.length, icon: <FiFileText className="h-5 w-5" /> },
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Death Registrations</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Manage death registrations</p>
          </div>
          <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Death Registrations' }]} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      <Card>
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
              <Button size="md">
                + New Registration
              </Button>
            </Link>
          }
        />

        {isFilterVisible && (
          <div className="relative flex flex-wrap items-center gap-4 mb-6 p-4 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700">
            <button
              onClick={() => setIsFilterVisible(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <FiX className="h-4 w-4" />
            </button>
            <div className="w-40">
              <Select
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' },
                ]}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>
          </div>
        )}

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchRegistrations} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <Table
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
      </Card>
    </div>
  );
}

