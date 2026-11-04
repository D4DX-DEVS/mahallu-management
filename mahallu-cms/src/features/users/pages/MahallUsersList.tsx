import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiPlus, FiUsers, FiXCircle } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
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
import StatusBadge from '@/components/ui/StatusBadge';
import { toTitleCase } from '@/utils/format';
import { logError } from '@/utils/safeLog';

export default function MahallUsersList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);

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
      logError('Error fetching users', err);
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

  const columns: TableColumn<User>[] = [
    {
      key: 'name',
      label: 'Name',
      width: '16rem',
      render: (name, row) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">{toTitleCase(name)}</div>
          <div className="mt-1">
            <StatusBadge status={row.status} />
          </div>
        </div>
      ),
    },
    {
      key: 'tenant', priority: 'secondary',
      label: 'Tenant',
      width: '12rem',
      render: (tenant, row: any) => {
        // Check both tenant and tenantId fields (populated reference)
        const tenantData = tenant || row.tenantId;
        return tenantData?.name ? toTitleCase(tenantData.name) : '-';
      },
    },
    { key: 'phone', priority: 'secondary', label: 'Phone', width: '9rem' },
    {
      key: 'email', priority: 'secondary',
      label: 'Email',
      width: '14rem',
      render: (email) => email || '-',
    },
    {
      key: 'joiningDate', priority: 'tertiary',
      label: 'Joining Date',
      width: '9rem',
      render: (date) => (date ? formatDate(date) : '-'),
    },
    {
      key: 'lastLogin', priority: 'tertiary',
      label: 'Last Login',
      width: '11rem',
      render: (lastLogin) => (lastLogin ? formatDateTime(lastLogin) : '-'),
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

  const isFiltered = Boolean(debouncedSearch);

  return (
    <>
      <PageHeader
        title="Mahallu users"
        description="Manage mahallu users and their permissions."
        actions={
          <Link to={ROUTES.USERS.CREATE_MAHALL}>
            <Button icon={<FiPlus />} collapseLabel>New user</Button>
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
          searchEntity="users"
          onRefresh={fetchUsers}
          onExport={handleExport}
          isExporting={isExporting}
        />

        {error ? (
          <EmptyState
            variant="error"
            entity="users"
            description={error}
            action={{ label: 'Try again', onClick: fetchUsers }}
          />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={users}
              isLoading={loading}
              entity="users"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); } }
                  : { label: 'Add user', onClick: () => navigate(ROUTES.USERS.CREATE_MAHALL) }
              }
              onRowClick={(row) => navigate(`/users/mahall/${row.id}`)}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="users"
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
