import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiEdit2, FiEye, FiPlus, FiUsers, FiXCircle } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import FilterPanel from '@/components/ui/FilterPanel';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import Badge from '@/components/ui/Badge';
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
import StatusBadge from '@/components/ui/StatusBadge';
import { toTitleCase } from '@/utils/format';
import { logError } from '@/utils/safeLog';

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
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  // A new search or filter invalidates the current page offset
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [debouncedSearch, roleFilter, statusFilter, currentPage, itemsPerPage]);

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
      logError('Error fetching users', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);

      // Fetch all filtered data, a page at a time — the API caps `limit` at 100
      const params: any = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (roleFilter !== 'all') params.role = roleFilter;
      if (statusFilter !== 'all') params.status = statusFilter;

      const dataToExport = await userService.getAllForExport(params);

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
    { key: 'name', label: 'Name', width: '16rem', sortable: true, render: (name) => <span className="font-medium text-foreground">{toTitleCase(name)}</span> },
    { key: 'phone', priority: 'secondary', label: 'Phone', width: '9rem' },
    { key: 'email', priority: 'secondary', label: 'Email', width: '14rem', render: (email) => email || '-' },
    {
      key: 'role',
      label: 'Role',
      width: '9rem',
      render: (role) => <Badge variant="info" className="capitalize">{role}</Badge>,
    },
    {
      key: 'status',
      label: 'Status',
      width: '8rem',
      render: (status) => <StatusBadge status={status || 'active'} />,
    },
    {
      key: 'createdAt', priority: 'tertiary',
      label: 'Created',
      width: '9rem',
      render: (date) => formatDate(date),
    },
    {
      key: 'actions',
      label: '',
      width: '6.5rem',
      align: 'right',
      sortable: false,
      render: (_, row) => (
        <ActionsMenu
          label={`Actions for ${toTitleCase(row.name)}`}
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

  const activeFilterCount = (roleFilter !== 'all' ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);
  const isFiltered = Boolean(debouncedSearch) || activeFilterCount > 0;

  return (
    <>
      <PageHeader
        title="All users"
        description="Manage all system users."
        actions={
          <Link to="/admin/users/create">
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
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={activeFilterCount}
          onRefresh={fetchUsers}
          onExport={handleExport}
          isExporting={isExporting}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-52">
              <Select
                label="Role"
                options={[
                  { value: 'all', label: 'All roles' },
                  { value: 'super_admin', label: 'Super admin' },
                  { value: 'mahall', label: 'Mahallu' },
                  { value: 'survey', label: 'Survey' },
                  { value: 'institute', label: 'Institute' },
                ]}
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              />
            </div>
            <div className="w-full sm:w-52">
              <Select
                label="Status"
                options={[
                  { value: 'all', label: 'All statuses' },
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                onClick={() => {
                  setRoleFilter('all');
                  setStatusFilter('all');
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
                  ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); setRoleFilter('all'); setStatusFilter('all'); } }
                  : { label: 'Add user', onClick: () => navigate('/admin/users/create') }
              }
              onRowClick={(row) => navigate(`/admin/users/${row.id}`)}
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
