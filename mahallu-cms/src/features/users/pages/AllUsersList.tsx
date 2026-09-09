import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiEdit2, FiEye, FiPlus, FiUsers, FiXCircle } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import FilterPanel from '@/components/ui/FilterPanel';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { User } from '@/types';
import { userService } from '@/services/userService';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import ActionsMenu from '@/components/ui/ActionsMenu';

export default function AllUsersList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchUsers();
  }, [debouncedSearch, roleFilter, statusFilter, currentPage]);

  const fetchUsers = async () => {
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
      if (roleFilter !== 'all') {
        params.role = roleFilter;
      }
      if (statusFilter !== 'all') {
        params.status = statusFilter;
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

      // Fetch all filtered data without pagination
      const params: any = { limit: 10000 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (roleFilter !== 'all') params.role = roleFilter;
      if (statusFilter !== 'all') params.status = statusFilter;

      const result = await userService.getAll(params);
      const dataToExport = result.data;

      if (dataToExport.length === 0) {
        toast.info('No data to export');
        return;
      }

      const filename = 'users';
      const title = 'All Users';

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
    { key: 'name', label: 'Name', width: '6.75rem', sortable: true },
    { key: 'phone', label: 'Phone', width: '6.75rem' },
    { key: 'email', label: 'Email', width: '6.75rem', render: (email) => email || '-' },
    {
      key: 'role',
      label: 'Role',
      width: '6rem',
      render: (role) => (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 capitalize">
          {role}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '7.25rem',
      render: (status) => (
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            status === 'active'
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}
        >
          {status || 'active'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      width: '7.75rem',
      render: (date) => formatDate(date),
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
                navigate(`/admin/users/${row.id}`);
              },
            },
            {
              label: 'Edit',
              icon: <FiEdit2 className="h-4 w-4" />,
              onClick: () => {
                navigate(`/admin/users/${row.id}/edit`);
              },
            },
          ]}
        />
      ),
    },
  ];

  const stats = [
    { title: 'Total Users', value: pagination?.total || users.length, icon: <FiUsers className="h-5 w-5" /> },
    {
      title: 'Active',
      value: users.filter((u) => u.status === 'active' || !u.status).length,
      icon: <FiCheckCircle className="h-5 w-5" />,
    },
    {
      title: 'Inactive',
      value: users.filter((u) => u.status === 'inactive').length,
      icon: <FiXCircle className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <PageHeader title="All Users" description="Manage all system users" />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
          onRefresh={fetchUsers}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={
            <Link to="/admin/users/create">
              <Button size="md" icon={<FiPlus />} collapseLabel>New User</Button>
            </Link>
          }
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-40">
              <Select
                options={[
                  { value: 'all', label: 'All Roles' },
                  { value: 'super_admin', label: 'Super Admin' },
                  { value: 'mahall', label: 'Mahall' },
                  { value: 'survey', label: 'Survey' },
                  { value: 'institute', label: 'Institute' },
                ]}
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-32">
              <Select
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>
          </FilterPanel>
        )}

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
            onRowClick={(row) => navigate(`/users/${row.id}`)}
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
