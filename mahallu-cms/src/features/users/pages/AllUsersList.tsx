import { useState, useEffect } from 'react';
import SavedViews from '@/components/ui/SavedViews';
import AppliedFilters from '@/components/ui/AppliedFilters';
import TableColumnMenu from '@/components/ui/TableColumnMenu';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useTableView } from '@/hooks/useTableView';
import { Link, useNavigate } from 'react-router-dom';
import { FiUsers, FiCheckCircle, FiXCircle, FiRefreshCw, FiDownload, FiFileText, FiFile } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { User } from '@/types';
import { userService } from '@/services/userService';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import StatusBadge from '@/components/ui/StatusBadge';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import Dropdown from '@/components/ui/Dropdown';
import { shareViz } from '@/utils/statSeries';

export default function AllUsersList() {
  const navigate = useNavigate();
  const filters = useUrlFilters({ role: 'all', status: 'all' });
  const { search: searchQuery, setSearch: setSearchQuery, debouncedSearch, page: currentPage, setPage: setCurrentPage, pageSize: itemsPerPage } = filters;
  const roleFilter = filters.values.role;
  const statusFilter = filters.values.status;
  const setRoleFilter = (v: string) => filters.setFilter('role', v);
  const setStatusFilter = (v: string) => filters.setFilter('status', v);
    const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);


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
      setError(getFriendlyError(err, "Couldn't load users. Refresh the page or try again."));
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
        toast.info('Nothing to export. Change your filters and try again.');
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
      toast.error(getFriendlyError(error, "Couldn't export data. Check your connection and try again."));
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<User>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'name', label: 'Name', sortable: true, render: (name, row) => <PersonCell name={name} src={row.photoUrl} /> },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email', render: (email) => email || '-' },
    {
      key: 'role',
      label: 'Role',
      render: (role) => (
        <StatusBadge status={role} tone="info" dot={false} />
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (status) => (
        <StatusBadge status={status || 'active'} />
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
      hideable: false,
      render: (_, row) => (
        <RowActions
          onView={() => navigate(`/admin/users/${row.id}`)}
          onEdit={() => navigate(`/admin/users/${row.id}/edit`)}
          ariaLabels={{ view: 'View user', edit: 'Edit user' }}
        />
      ),
    },
  ];

  const view = useTableView('users', columns);

  const stats = [
    { title: 'Total Users', value: pagination?.total || users.length, icon: <FiUsers className="h-[17px] w-[17px]" />, tone: 'green' as const },
    {
      title: 'Active',
      value: users.filter((u) => u.status === 'active' || !u.status).length, viz: shareViz(users.filter((u) => u.status === 'active' || !u.status).length, users.length), summary: `Active: ${users.filter((u) => u.status === 'active' || !u.status).length} of ${users.length}`,
      icon: <FiCheckCircle className="h-[17px] w-[17px]" />, tone: 'lime' as const,
    },
    {
      title: 'Inactive',
      value: users.filter((u) => u.status === 'inactive').length, viz: shareViz(users.filter((u) => u.status === 'inactive').length, users.length, '#E0B400'), summary: `Inactive: ${users.filter((u) => u.status === 'inactive').length} of ${users.length}`,
      icon: <FiXCircle className="h-[17px] w-[17px]" />, tone: 'neutral' as const,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="All Users"
        description="Manage all system users"
        actions={
          <Link to="/admin/users/create">
            <Button>+ New User</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard key={index} variant="inline" {...stat} />
        ))}
      </div>

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search' }}
          actions={
            <>
              <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={fetchUsers}>
                <FiRefreshCw className="h-3.5 w-3.5" />
              </Button>
              <TableColumnMenu {...view.menuProps} />
              <Dropdown
                trigger={
                  <Button variant="secondary" isLoading={isExporting}>
                    {!isExporting && <FiDownload className="h-3.5 w-3.5" />}
                    Export
                  </Button>
                }
                items={[
                  { label: 'Export CSV', icon: <FiFileText />, onClick: () => handleExport('csv'), disabled: isExporting },
                  { label: 'Export JSON', icon: <FiFile />, onClick: () => handleExport('json'), disabled: isExporting },
                  { label: 'Export PDF', icon: <FiDownload />, onClick: () => handleExport('pdf'), disabled: isExporting },
                ]}
              />
            </>
          }
        >
          <div className="w-40">
            <Select
              aria-label="Filter by role"
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
          <div className="w-32">
            <Select
              aria-label="Filter by status"
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
          <SavedViews pageKey="users" filters={filters} />
        </FilterBar>
        <AppliedFilters filters={filters} config={{role: { label: 'Role', format: (v) => v.replace(/_/g, ' ') }, status: { label: 'Status' }}} />

        <div className="p-3.5">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchUsers} className="mt-4" variant="secondary">
              Retry
            </Button>
          </div>
        ) : (
          <Table
            columns={view.columns}
            density={view.density}
            filtersActive={filters.activeCount > 0}
            onClearFilters={filters.clear}
            data={users}
            emptyMessage="No users found"
            showExport={false}
            onRowClick={(row) => navigate(`/users/${row.id}`)}
          />
        )}

        {/* Pagination */}
        {pagination && (
          <div className="mt-3.5">
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
        </div>
      </Card>
    </div>
  );
}

