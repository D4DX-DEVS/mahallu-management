import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FiCheckCircle, FiEdit2, FiEye, FiPlus, FiTrash2, FiUsers, FiXCircle } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import FilterPanel from '@/components/ui/FilterPanel';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { Employee } from '@/types';
import { ROUTES } from '@/constants/routes';
import { employeeService } from '@/services/employeeService';
import { instituteService } from '@/services/instituteService';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import ActionsMenu from '@/components/ui/ActionsMenu';
import StatusBadge from '@/components/ui/StatusBadge';

export default function EmployeesList() {
  const navigate = useNavigate();
  const { currentInstituteId: userInstituteId } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [isFilterVisible, setIsFilterVisible] = useState(
    !!(searchParams.get('status') || searchParams.get('institute'))
  );
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [instituteFilter, setInstituteFilter] = useState(
    searchParams.get('institute') || userInstituteId || 'all'
  );
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [institutes, setInstitutes] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(() => {
    const page = Number(searchParams.get('page'));
    return page > 0 ? page : 1;
  });
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    if (!userInstituteId) {
      fetchInstitutes();
    }
  }, []);

  // Skipped on the mount that restores a page from the URL.
  const skipPageReset = useRef(true);
  useEffect(() => {
    if (skipPageReset.current) {
      skipPageReset.current = false;
      return;
    }
    setCurrentPage(1);
  }, [debouncedSearch]);

  // Keep the URL in sync so a filtered/paged list survives navigating to a
  // detail page and back, and survives a refresh.
  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedSearch) next.set('q', debouncedSearch);
    if (statusFilter !== 'all') next.set('status', statusFilter);
    if (instituteFilter !== 'all' && instituteFilter !== userInstituteId) next.set('institute', instituteFilter);
    if (currentPage > 1) next.set('page', String(currentPage));
    setSearchParams(next, { replace: true });
  }, [debouncedSearch, statusFilter, instituteFilter, currentPage, userInstituteId, setSearchParams, itemsPerPage]);

  useEffect(() => {
    fetchEmployees();
  }, [debouncedSearch, statusFilter, instituteFilter, currentPage]);

  const fetchInstitutes = async () => {
    try {
      const rows = await instituteService.getAllForExport();
      setInstitutes(rows.map((i: any) => ({ id: i.id, name: i.name })));
    } catch (err) {
      console.error('Error fetching institutes:', err);
    }
  };

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { page: currentPage, limit: itemsPerPage };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter !== 'all') params.status = statusFilter;
      if (instituteFilter !== 'all') params.instituteId = instituteFilter;
      const result = await employeeService.getAll(params);
      setEmployees(result.data);
      if (result.pagination) setPagination(result.pagination);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'employees'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedEmployee) return;
    try {
      setDeleting(true);
      await employeeService.delete(selectedEmployee.id);
      await fetchEmployees();
      toast.success('Employee deleted');
      setShowDeleteModal(false);
      setSelectedEmployee(null);
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete employee' }));
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn<Employee>[] = [
    {
      key: 'name',
      label: 'Name',
      width: '16rem',
      sortable: true,
      render: (v) => <span className="font-medium text-foreground">{toTitleCase(v)}</span>,
    },
    { key: 'designation', label: 'Designation', width: '12rem', render: (v) => toTitleCase(v) },
    { key: 'department', priority: 'secondary', label: 'Department', width: '12rem', render: (v) => toTitleCase(v) },
    { key: 'phone', priority: 'secondary', label: 'Phone', width: '9rem' },
    {
      key: 'salary',
      label: 'Salary',
      width: '9rem',
      align: 'right',
      render: (salary) => (salary ? `₹${Number(salary).toLocaleString()}` : '-'),
    },
    {
      key: 'status',
      label: 'Status',
      width: '8rem',
      render: (status) => <StatusBadge status={status || 'active'} />,
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
              onClick: () => navigate(ROUTES.EMPLOYEES.DETAIL(row.id)),
            },
            {
              label: 'Edit',
              icon: <FiEdit2 className="h-4 w-4" />,
              onClick: () => navigate(ROUTES.EMPLOYEES.EDIT(row.id)),
            },
            {
              label: 'Delete',
              icon: <FiTrash2 className="h-4 w-4" />,
              onClick: () => {
                setSelectedEmployee(row);
                setShowDeleteModal(true);
              },
              variant: 'danger',
            },
          ]}
        />
      ),
    },
  ];

  const stats = [
    {
      title: 'Total Employees',
      value: pagination?.total || employees.length,
      icon: <FiUsers className="h-5 w-5" />,
    },
    {
      title: 'Active',
      value: employees.filter((e) => e.status === 'active' || !e.status).length,
      icon: <FiCheckCircle className="h-5 w-5" />,
    },
    {
      title: 'Inactive/Left',
      value: employees.filter((e) => e.status === 'resigned' || e.status === 'terminated').length,
      icon: <FiXCircle className="h-5 w-5" />,
    },
  ];

  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (!userInstituteId && instituteFilter !== 'all' ? 1 : 0);
  const isFiltered = Boolean(debouncedSearch) || activeFilterCount > 0;

  return (
    <>
      <PageHeader
        title="Employees"
        description="Manage institute employees."
        actions={
          <Link to={ROUTES.EMPLOYEES.CREATE}>
            <Button icon={<FiPlus />} collapseLabel>New employee</Button>
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
          searchEntity="employees"
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={activeFilterCount}
          onRefresh={fetchEmployees}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-52">
              <Select
                label="Status"
                options={[
                  { value: 'all', label: 'All statuses' },
                  { value: 'active', label: 'Active' },
                  { value: 'on_leave', label: 'On leave' },
                  { value: 'resigned', label: 'Resigned' },
                  { value: 'terminated', label: 'Terminated' },
                ]}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            {!userInstituteId && (
              <div className="w-full sm:w-52">
                <Select
                  label="Institute"
                  options={[
                    { value: 'all', label: 'All institutes' },
                    ...institutes.map((i) => ({ value: i.id, label: toTitleCase(i.name) })),
                  ]}
                  value={instituteFilter}
                  onChange={(e) => {
                    setInstituteFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                onClick={() => {
                  setStatusFilter('all');
                  if (!userInstituteId) setInstituteFilter('all');
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
            entity="employees"
            description={error}
            action={{ label: 'Try again', onClick: fetchEmployees }}
          />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={employees}
              isLoading={loading}
              entity="employees"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); setStatusFilter('all'); if (!userInstituteId) setInstituteFilter('all'); setCurrentPage(1); } }
                  : { label: 'Add employee', onClick: () => navigate(ROUTES.EMPLOYEES.CREATE) }
              }
              onRowClick={(row) => navigate(ROUTES.EMPLOYEES.DETAIL(row.id))}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="employees"
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

      <ConfirmDialog
        isOpen={showDeleteModal}
        title="Delete employee"
        message={`Are you sure you want to delete ${toTitleCase(selectedEmployee?.name) || 'this employee'}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setShowDeleteModal(false);
          setSelectedEmployee(null);
        }}
      />
    </>
  );
}
