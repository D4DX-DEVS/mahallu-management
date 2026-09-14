import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiEdit2, FiEye, FiPlus, FiTrash2, FiUsers, FiXCircle } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import FilterPanel from '@/components/ui/FilterPanel';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { Employee } from '@/types';
import { ROUTES } from '@/constants/routes';
import { employeeService } from '@/services/employeeService';
import { instituteService } from '@/services/instituteService';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuthStore } from '@/store/authStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import ActionsMenu from '@/components/ui/ActionsMenu';

export default function EmployeesList() {
  const navigate = useNavigate();
  const { currentInstituteId: userInstituteId } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [instituteFilter, setInstituteFilter] = useState(userInstituteId || 'all');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [institutes, setInstitutes] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    if (!userInstituteId) {
      fetchInstitutes();
    }
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

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
      setShowDeleteModal(false);
      setSelectedEmployee(null);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'delete employee' }));
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn<Employee>[] = [
    {
      key: 'name',
      label: 'Name',
      width: '6.75rem',
      sortable: true,
      render: (v) => <span>{toTitleCase(v)}</span>,
    },
    { key: 'designation', label: 'Designation', width: '9.25rem', render: (v) => toTitleCase(v) },
    { key: 'department', label: 'Department', width: '9.75rem', render: (v) => toTitleCase(v) },
    { key: 'phone', label: 'Phone', width: '6.75rem' },
    {
      key: 'salary',
      label: 'Salary',
      width: '8.75rem',
      align: 'center',
      render: (salary) => (salary ? `₹${Number(salary).toLocaleString()}` : '-'),
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
              : status === 'on_leave'
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}
        >
          {status === 'on_leave' ? 'On Leave' : status || 'active'}
        </span>
      ),
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

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <PageHeader title="Employees" description="Manage institute employees" />
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
          onRefresh={fetchEmployees}
          actionButtons={
            <Link to={ROUTES.EMPLOYEES.CREATE}>
              <Button size="md" icon={<FiPlus />} collapseLabel>New Employee</Button>
            </Link>
          }
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-40">
              <Select
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'active', label: 'Active' },
                  { value: 'on_leave', label: 'On Leave' },
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
              <div className="w-full sm:w-48">
                <Select
                  options={[
                    { value: 'all', label: 'All Institutes' },
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
          </FilterPanel>
        )}

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchEmployees} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <Table
            fixedLayout
            striped
            columns={columns}
            data={employees}
            emptyMessage="No employees found"
            showExport={false}
            onRowClick={(row) => navigate(ROUTES.EMPLOYEES.DETAIL(row.id))}
          />
        )}

        {pagination && (
          <div className="mt-4">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </TableCard>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedEmployee(null);
        }}
        title="Delete Employee"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedEmployee(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          Are you sure you want to delete <strong>{toTitleCase(selectedEmployee?.name)}</strong>? This action cannot be
          undone.
        </p>
      </Modal>
    </div>
  );
}
