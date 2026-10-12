import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiUsers, FiCheckCircle, FiXCircle, FiRefreshCw } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import FilterBar from '@/components/ui/FilterBar';
import StatusBadge from '@/components/ui/StatusBadge';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { Employee } from '@/types';
import { ROUTES } from '@/constants/routes';
import { employeeService } from '@/services/employeeService';
import { instituteService } from '@/services/instituteService';
import { useDebounce } from '@/hooks/useDebounce';
import { useAuthStore } from '@/store/authStore';
import { shareViz } from '@/utils/statSeries';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

export default function EmployeesList() {
  const navigate = useNavigate();
  const { currentInstituteId: userInstituteId } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
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
    fetchEmployees();
  }, [debouncedSearch, statusFilter, instituteFilter, currentPage]);

  const fetchInstitutes = async () => {
    try {
      const result = await instituteService.getAll({ limit: 1000 });
      setInstitutes(result.data.map((i: any) => ({ id: i.id, name: i.name })));
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
      setError(getFriendlyError(err, "Couldn't load employees. Refresh the page or try again."));
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
      toast.error(getFriendlyError(err, "Couldn't delete employee. Try again in a moment."));
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn<Employee>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'name', label: 'Name', sortable: true, render: (name, row) => <PersonCell name={name} subtitle={row.designation} /> },
    { key: 'designation', label: 'Designation', render: (v) => (v ? <StatusBadge status={v} tone="neutral" dot={false} /> : '-') },
    { key: 'department', label: 'Department', render: (v) => (v ? <StatusBadge status={v} tone="neutral" dot={false} /> : '-') },
    { key: 'phone', label: 'Phone' },
    {
      key: 'salary',
      label: 'Salary',
      render: (salary) => salary ? `₹${Number(salary).toLocaleString()}` : '-',
    },
    {
      key: 'status',
      label: 'Status',
      render: (status) => <StatusBadge status={status || 'active'} label={status === 'on_leave' ? 'On Leave' : undefined} tone={status === 'on_leave' ? 'warning' : status === 'resigned' || status === 'terminated' ? 'neutral' : undefined} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <RowActions
          onView={() => navigate(ROUTES.EMPLOYEES.DETAIL(row.id))}
          onEdit={() => navigate(ROUTES.EMPLOYEES.EDIT(row.id))}
          onDelete={() => { setSelectedEmployee(row); setShowDeleteModal(true); }}
          ariaLabels={{ view: 'View employee', edit: 'Edit employee', delete: 'Delete employee' }}
        />
      ),
    },
  ];

  const stats = [
    { title: 'Total Employees', value: pagination?.total || employees.length, icon: <FiUsers className="h-[17px] w-[17px]" />, tone: 'green' as const },
    { title: 'Active', value: employees.filter(e => e.status === 'active' || !e.status).length, viz: shareViz(employees.filter(e => e.status === 'active' || !e.status).length, employees.length), summary: `Active: ${employees.filter(e => e.status === 'active' || !e.status).length} of ${employees.length}`, icon: <FiCheckCircle className="h-[17px] w-[17px]" />, tone: 'lime' as const },
    { title: 'Inactive/Left', value: employees.filter(e => e.status === 'resigned' || e.status === 'terminated').length, viz: shareViz(employees.filter(e => e.status === 'resigned' || e.status === 'terminated').length, employees.length, '#E0B400'), summary: `Inactive/Left: ${employees.filter(e => e.status === 'resigned' || e.status === 'terminated').length} of ${employees.length}`, icon: <FiXCircle className="h-[17px] w-[17px]" />, tone: 'neutral' as const },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Employees"
        description="Manage institute employees"
        actions={
          <Link to={ROUTES.EMPLOYEES.CREATE}>
            <Button>+ New employee</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => (<StatCard key={index} variant="inline" {...stat} />))}
      </div>

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search employees' }}
          actions={
            <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={fetchEmployees}>
              <FiRefreshCw className="h-3.5 w-3.5" />
            </Button>
          }
        >
          <div className="w-40">
            <Select
              options={[
                { value: 'all', label: 'All Status' },
                { value: 'active', label: 'Active' },
                { value: 'on_leave', label: 'On Leave' },
                { value: 'resigned', label: 'Resigned' },
                { value: 'terminated', label: 'Terminated' },
              ]}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            />
          </div>
          {!userInstituteId && (
            <div className="w-48">
              <Select
                options={[
                  { value: 'all', label: 'All Institutes' },
                  ...institutes.map(i => ({ value: i.id, label: i.name })),
                ]}
                value={instituteFilter}
                onChange={(e) => setInstituteFilter(e.target.value)}
              />
            </div>
          )}
        </FilterBar>

        <div className="p-3.5">
        {loading ? (
          <div className="flex justify-center items-center py-12"><LoadingSpinner /></div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchEmployees} className="mt-4" variant="secondary">Retry</Button>
          </div>
        ) : (
          <Table
            columns={columns}
            data={employees}
            emptyMessage="No employees found"
            showExport={false}
            onRowClick={(row) => navigate(ROUTES.EMPLOYEES.DETAIL(row.id))}
          />
        )}

        {pagination && (
          <div className="mt-3.5">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
        </div>
      </Card>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setSelectedEmployee(null); }}
        title="Delete employee?"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowDeleteModal(false); setSelectedEmployee(null); }}>Cancel</Button>
            <Button variant="danger-solid" onClick={handleDelete} isLoading={deleting}>Delete</Button>
          </>
        }
      >
        <p className="text-[13px] text-[#5B6963] dark:text-surface-muted">
          Delete <strong>{selectedEmployee?.name}</strong>? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
