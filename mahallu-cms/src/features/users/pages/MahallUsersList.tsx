import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiEdit2, FiPlus, FiUsers, FiXCircle } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import { rowActionClass } from '@/components/ui/rowAction';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { User } from '@/types';
import { ROUTES } from '@/constants/routes';
import { userService } from '@/services/userService';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate, formatDateTime } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

export default function MahallUsersList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  // A new search invalidates the current page offset
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchUsers();
  }, [debouncedSearch, currentPage]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        role: 'mahall',
        page: currentPage,
        limit: itemsPerPage,
      };
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      const result = await userService.getAll(params);
      setUsers(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(loadErrorMessage(err, 'users'));
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);

      // Gathered a page at a time — the API caps `limit` at 100
      const params: any = { role: 'mahall' };
      if (debouncedSearch) params.search = debouncedSearch;

      const dataToExport = await userService.getAllForExport(params);

      if (dataToExport.length === 0) {
        toast.info('No data to export');
        return;
      }

      const filename = 'mahall-users';
      const title = 'Mahall Users';

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
      toast.error(errorMessage(error, { action: 'export data' }));
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<User>[] = [
    {
      key: 'name',
      label: 'Name',
      width: '6.75rem',
      render: (name, row) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">{toTitleCase(name)}</div>
          <span
            className={`inline-block mt-1 px-2 py-0.5 text-xs font-medium rounded-full ${
              row.status === 'active'
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}
          >
            {row.status}
          </span>
        </div>
      ),
    },
    {
      key: 'tenant',
      label: 'Tenant',
      width: '7.25rem',
      render: (tenant, row: any) => {
        // Check both tenant and tenantId fields (populated reference)
        const tenantData = tenant || row.tenantId;
        return tenantData?.name ? toTitleCase(tenantData.name) : '-';
      },
    },
    { key: 'phone', label: 'Phone', width: '6.75rem' },
    {
      key: 'email',
      label: 'Email',
      width: '6.75rem',
      render: (email) => email || '-',
    },
    {
      key: 'joiningDate',
      label: 'Joining Date',
      width: '10rem',
      render: (date) => (date ? formatDate(date) : '-'),
    },
    {
      key: 'lastLogin',
      label: 'Last Login',
      width: '9.25rem',
      render: (lastLogin) => (lastLogin ? formatDateTime(lastLogin) : '-'),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '8rem',
      align: 'center',
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(ROUTES.USERS.EDIT_MAHALL(row.id));
            }}
            className={rowActionClass()}
            title="Edit"
            aria-label="Edit"
          >
            <FiEdit2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const stats = [
    { title: 'Total Users', value: pagination?.total || users.length, icon: <FiUsers className="h-5 w-5" /> },
    {
      title: 'Active Users',
      value: users.filter((u) => u.status === 'active').length,
      icon: <FiCheckCircle className="h-5 w-5" />,
    },
    {
      title: 'Inactive Users',
      value: users.filter((u) => u.status === 'inactive').length,
      icon: <FiXCircle className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <PageHeader title="All Mahall Users" description="Manage mahall users and their permissions" />

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      {/* Actions and Table */}
      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
          isFilterVisible={isFilterVisible}
          hasFilters={false}
          onRefresh={fetchUsers}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={
            <Link to={ROUTES.USERS.CREATE_MAHALL}>
              <Button size="md" icon={<FiPlus />} collapseLabel>New User</Button>
            </Link>
          }
        />

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchUsers} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <Table
            fixedLayout
            striped
            columns={columns}
            data={users}
            emptyMessage="No users found"
            showExport={false}
            onRowClick={(row) => navigate(`/users/mahall/${row.id}`)}
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
