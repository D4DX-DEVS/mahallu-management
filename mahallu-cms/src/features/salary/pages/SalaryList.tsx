import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FiBarChart2, FiCheckCircle, FiClock, FiDollarSign, FiEdit2, FiEye, FiPlus, FiTrash2 } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import FilterPanel from '@/components/ui/FilterPanel';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { SalaryPayment } from '@/types';
import { ROUTES } from '@/constants/routes';
import { salaryService, type SalaryListSummary } from '@/services/salaryService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import ActionsMenu from '@/components/ui/ActionsMenu';
import StatusBadge from '@/components/ui/StatusBadge';
import { toTitleCase } from '@/utils/format';
import { fetchAllPages } from '@/services/api';
import { logError } from '@/utils/safeLog';

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

const getMonthName = (month: number) => MONTHS.find((m) => m.value === String(month))?.label || String(month);

export default function SalaryList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentInstituteId: userInstituteId } = useAuthStore();
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [instituteFilter, setInstituteFilter] = useState(userInstituteId || 'all');
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [institutes, setInstitutes] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [summary, setSummary] = useState<SalaryListSummary | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; label: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!userInstituteId) fetchInstitutes();
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [statusFilter, monthFilter, yearFilter, instituteFilter, currentPage, itemsPerPage]);

  const fetchInstitutes = async () => {
    try {
      const allRows = await fetchAllPages((page) => instituteService.getAll(page));
      setInstitutes(allRows.map((i: any) => ({ id: i.id, name: i.name })));
    } catch (err) {
      logError('Error fetching institutes', err);
    }
  };

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { page: currentPage, limit: itemsPerPage };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (monthFilter !== 'all') params.month = Number(monthFilter);
      if (yearFilter !== 'all') params.year = Number(yearFilter);
      if (instituteFilter !== 'all') params.instituteId = instituteFilter;
      const employeeId = searchParams.get('employeeId');
      if (employeeId) params.employeeId = employeeId;
      const result = await salaryService.getAll(params);
      setPayments(result.data);
      setSummary(result.summary);
      if (result.pagination) setPagination(result.pagination);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'salary payments'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (id: string, label: string) => {
    setDeleteConfirm({ id, label });
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setIsDeleting(true);
      await salaryService.delete(deleteConfirm.id);
      toast.success('Salary payment deleted');
      setDeleteConfirm(null);
      await fetchPayments();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete salary payment' }));
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: TableColumn<SalaryPayment>[] = [
    {
      key: 'employeeId',
      label: 'Employee',
      width: '16rem',
      render: (emp) => (
        <span className="font-medium text-foreground">
          {typeof emp === 'object' && emp?.name ? toTitleCase(emp.name) : emp || '—'}
        </span>
      ),
    },
    { key: 'month', label: 'Period', width: '10rem', render: (_, row) => `${getMonthName(row.month)} ${row.year}` },
    { key: 'baseSalary', priority: 'secondary', label: 'Base', width: '9rem', render: (v) => `₹${Number(v || 0).toLocaleString()}` },
    {
      key: 'netAmount',
      label: 'Net amount',
      width: '10rem',
      align: 'right',
      render: (v) => <span className="font-semibold">₹{Number(v || 0).toLocaleString()}</span>,
    },
    { key: 'paymentMethod', priority: 'tertiary', label: 'Method', width: '9rem', render: (v) => v || '-' },
    {
      key: 'status',
      label: 'Status',
      width: '8rem',
      render: (status) => <StatusBadge status={status || 'pending'} />,
    },
    {
      key: 'actions',
      label: '',
      width: '6.5rem',
      align: 'right',
      sortable: false,
      render: (_, row) => {
        const empLabel =
          typeof row.employeeId === 'object' && row.employeeId?.name
            ? toTitleCase(row.employeeId.name)
            : 'this employee';
        return (
          <ActionsMenu
            label={`Actions for ${empLabel}`}
            items={[
              {
                label: 'View',
                icon: <FiEye className="h-4 w-4" />,
                onClick: () => navigate(ROUTES.SALARY.DETAIL(row.id)),
              },
              {
                label: 'Edit',
                icon: <FiEdit2 className="h-4 w-4" />,
                onClick: () => navigate(ROUTES.SALARY.EDIT(row.id)),
              },
              {
                label: 'Delete',
                icon: <FiTrash2 className="h-4 w-4" />,
                onClick: () =>
                  handleDeleteClick(row.id, `${getMonthName(row.month)} ${row.year} – ${empLabel}`),
                variant: 'danger',
              },
            ]}
          />
        );
      },
    },
  ];

  // The cards cover the whole filtered list (server summary), not just the rows on this page.
  const totalPaid = summary
    ? summary.paidAmount
    : payments.filter((p) => p.status === 'paid').reduce((sum, p) => sum + (p.netAmount || 0), 0);
  const totalPending = summary
    ? summary.pendingAmount
    : payments.filter((p) => p.status === 'pending').reduce((sum, p) => sum + (p.netAmount || 0), 0);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => ({
    value: String(currentYear - i),
    label: String(currentYear - i),
  }));

  const activeFilterCount = [statusFilter, monthFilter, yearFilter].filter((v) => v !== 'all').length + (!userInstituteId && instituteFilter !== 'all' ? 1 : 0);
  const isFiltered = activeFilterCount > 0;

  return (
    <>
      <PageHeader
        title="Salary payments"
        description="Manage employee salary payments."
        actions={
          <>
            <Link to={ROUTES.SALARY.SUMMARY}>
              <Button variant="outline" icon={<FiBarChart2 />} collapseLabel>Summary</Button>
            </Link>
            <Link to={ROUTES.SALARY.CREATE}>
              <Button icon={<FiPlus />} collapseLabel>New payment</Button>
            </Link>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          title="Total Payments"
          value={pagination?.total || payments.length}
          icon={<FiDollarSign className="h-5 w-5" />}
        />
        <StatCard
          title="Total Paid"
          value={`₹${totalPaid.toLocaleString()}`}
          icon={<FiCheckCircle className="h-5 w-5" />}
        />
        <StatCard
          title="Total Pending"
          value={`₹${totalPending.toLocaleString()}`}
          icon={<FiClock className="h-5 w-5" />}
        />
      </div>

      <TableCard>
        <TableToolbar
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={activeFilterCount}
          onRefresh={fetchPayments}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-44">
              <Select
                label="Status"
                options={[
                  { value: 'all', label: 'All statuses' },
                  { value: 'paid', label: 'Paid' },
                  { value: 'pending', label: 'Pending' },
                  { value: 'cancelled', label: 'Cancelled' },
                ]}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="w-full sm:w-44">
              <Select
                label="Month"
                options={[{ value: 'all', label: 'All months' }, ...MONTHS]}
                value={monthFilter}
                onChange={(e) => {
                  setMonthFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="w-full sm:w-36">
              <Select
                label="Year"
                options={[{ value: 'all', label: 'All years' }, ...years]}
                value={yearFilter}
                onChange={(e) => {
                  setYearFilter(e.target.value);
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
                  setMonthFilter('all');
                  setYearFilter('all');
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
            entity="salary payments"
            description={error}
            action={{ label: 'Try again', onClick: fetchPayments }}
          />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={payments}
              isLoading={loading}
              entity="salary payments"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setStatusFilter('all'); setMonthFilter('all'); setYearFilter('all'); if (!userInstituteId) setInstituteFilter('all'); setCurrentPage(1); } }
                  : { label: 'Record payment', onClick: () => navigate(ROUTES.SALARY.CREATE) }
              }
              onRowClick={(row) => navigate(ROUTES.SALARY.DETAIL(row.id))}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="salary payments"
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
        isOpen={deleteConfirm !== null}
        title="Delete Salary Payment"
        message={deleteConfirm ? `Delete salary payment for ${deleteConfirm.label}?` : ''}
        consequence="This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </>
  );
}
