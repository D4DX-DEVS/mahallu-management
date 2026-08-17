import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEye, FiEdit2, FiUsers, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { User } from '@/types';
import { userService } from '@/services/userService';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';

export default function InstituteUsersList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const debouncedSearch = useDebounce(searchQuery, 500);

  // A new search invalidates the current page offset
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchUsers();
  }, [debouncedSearch, currentPage, itemsPerPage]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { role: 'institute', page: currentPage, limit: itemsPerPage };
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      const result = await userService.getAll(params);
      setUsers(result.data || []);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch institute users');
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      
      const params: any = { role: 'institute', limit: 10000 };
      if (debouncedSearch) params.search = debouncedSearch;
      
      const result = await userService.getAll(params);
      const dataToExport = result.data;

      if (dataToExport.length === 0) {
        toast.info('No data to export');
        return;
      }

      const filename = 'institute-users';
      const title = 'Institute Users';

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

  const columns: TableColumn<User>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'name', label: 'Name', sortable: true },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email', render: (email) => email || '-' },
    {
      key: 'status',
      label: 'Status',
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
      render: (date) => formatDate(date),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/users/institute/${row.id}`);
            }}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            title="View"
          >
            <FiEye className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/users/institute/${row.id}/edit`);
            }}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            title="Edit"
          >
            <FiEdit2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const stats = [
    // ponytail: total comes from the server; Active/Inactive still count the current page
    { title: 'Total Institute Users', value: pagination?.total ?? users.length, icon: <FiUsers className="h-5 w-5" /> },
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Institute Users</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Manage institute users</p>
          </div>
          <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Institute Users' }]} />
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
          hasFilters={false}
          onRefresh={fetchUsers}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={
            <Link to="/users/institute/create">
              <Button size="md">
                + New Institute User
              </Button>
            </Link>
          }
        />

        {error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchUsers} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <>
            <Table
              columns={columns}
              data={users}
              isLoading={loading}
              emptyMessage="No institute users found"
              showExport={false}
              onRowClick={(row) => navigate(`/users/institute/${row.id}`)}
            />
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(items) => {
                    setItemsPerPage(items);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

