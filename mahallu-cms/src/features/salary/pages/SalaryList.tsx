import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FiDollarSign, FiCheckCircle, FiClock, FiRefreshCw } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import FilterBar from '@/components/ui/FilterBar';
import StatusBadge from '@/components/ui/StatusBadge';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { SalaryPayment } from '@/types';
import { ROUTES } from '@/constants/routes';
import { salaryService } from '@/services/salaryService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import { monthlySeries } from '@/utils/statSeries';
import { getFriendlyError } from '@/utils/apiMessages';

const MONTHS = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
  { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
  { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
];

const getMonthName = (month: number) => MONTHS.find(m => m.value === String(month))?.label || String(month);

export default function SalaryList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { currentInstituteId: userInstituteId } = useAuthStore();
  const [statusFilter, setStatusFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));
  const [instituteFilter, setInstituteFilter] = useState(userInstituteId || 'all');
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [institutes, setInstitutes] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationType | null>(null);

  useEffect(() => {
    if (!userInstituteId) fetchInstitutes();
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [statusFilter, monthFilter, yearFilter, instituteFilter, currentPage]);

  const fetchInstitutes = async () => {
    try {
      const result = await instituteService.getAll({ limit: 1000 });
      setInstitutes(result.data.map((i: any) => ({ id: i.id, name: i.name })));
    } catch (err) { console.error('Error fetching institutes:', err); }
  };

  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { page: currentPage, limit: 10 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (monthFilter !== 'all') params.month = Number(monthFilter);
      if (yearFilter !== 'all') params.year = Number(yearFilter);
      if (instituteFilter !== 'all') params.instituteId = instituteFilter;
      const employeeId = searchParams.get('employeeId');
      if (employeeId) params.employeeId = employeeId;
      const result = await salaryService.getAll(params);
      setPayments(result.data);
      if (result.pagination) setPagination(result.pagination);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load salary payments. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  const columns: TableColumn<SalaryPayment>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'employeeId', label: 'Employee', render: (emp) => { const nm = (typeof emp === 'object' && emp?.name) ? emp.name : emp; return nm ? <PersonCell name={String(nm)} size={32} /> : '-'; } },
    { key: 'month', label: 'Period', render: (_, row) => `${getMonthName(row.month)} ${row.year}` },
    { key: 'baseSalary', label: 'Base', render: (v) => `₹${Number(v || 0).toLocaleString()}` },
    { key: 'netAmount', label: 'Net Amount', render: (v) => <span className="font-semibold">₹{Number(v || 0).toLocaleString()}</span> },
    { key: 'paymentMethod', label: 'Method', render: (v) => (v ? <StatusBadge status={v} tone="neutral" dot={false} /> : '-') },
    {
      key: 'status',
      label: 'Status',
      render: (status) => <StatusBadge status={status || 'pending'} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <RowActions onView={() => navigate(ROUTES.SALARY.DETAIL(row.id))} viewLabel="View payment" ariaLabels={{ view: 'View payment' }} />
      ),
    },
  ];

  const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.netAmount || 0), 0);
  const totalPending = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + (p.netAmount || 0), 0);

  const payMonths = monthlySeries(payments as any[], (p: any) => p.paymentDate || p.createdAt);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => ({ value: String(currentYear - i), label: String(currentYear - i) }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Salary Payments"
        description="Manage employee salary payments"
        actions={
          <>
            <Link to={ROUTES.SALARY.SUMMARY}><Button variant="secondary">Summary</Button></Link>
            <Link to={ROUTES.SALARY.CREATE}><Button>+ New payment</Button></Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard variant="inline" viz={payMonths.length ? { type: 'bars', values: payMonths } : undefined} title="Total Payments" value={pagination?.total || payments.length} icon={<FiDollarSign className="h-[17px] w-[17px]" />} tone="green" />
        <StatCard variant="inline" viz={totalPaid + totalPending > 0 ? { type: 'segments', segments: [{ value: totalPaid }, { value: totalPending, color: '#FDD817' }] } : undefined} summary={`Paid ₹${totalPaid.toLocaleString()}, pending ₹${totalPending.toLocaleString()}`} title="Total Paid" value={`₹${totalPaid.toLocaleString()}`} icon={<FiCheckCircle className="h-[17px] w-[17px]" />} tone="lime" />
        <StatCard variant="inline" viz={payments.filter((p) => p.status === 'pending').length > 0 ? { type: 'dots', count: payments.filter((p) => p.status === 'pending').length } : undefined} summary={`${payments.filter((p) => p.status === 'pending').length} salary payments pending, ₹${totalPending.toLocaleString()}`} title="Total Pending" value={`₹${totalPending.toLocaleString()}`} icon={<FiClock className="h-[17px] w-[17px]" />} tone="gold" />
      </div>

      <Card padding="none" className="overflow-visible">
        <FilterBar
          actions={
            <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={fetchPayments}>
              <FiRefreshCw className="h-3.5 w-3.5" />
            </Button>
          }
        >
          <div className="w-36">
            <Select options={[{ value: 'all', label: 'All Status' }, { value: 'paid', label: 'Paid' }, { value: 'pending', label: 'Pending' }, { value: 'cancelled', label: 'Cancelled' }]} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
          </div>
          <div className="w-36">
            <Select options={[{ value: 'all', label: 'All Months' }, ...MONTHS]} value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
          </div>
          <div className="w-28">
            <Select options={[{ value: 'all', label: 'All Years' }, ...years]} value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} />
          </div>
          {!userInstituteId && (
            <div className="w-48">
              <Select options={[{ value: 'all', label: 'All Institutes' }, ...institutes.map(i => ({ value: i.id, label: i.name }))]} value={instituteFilter} onChange={(e) => setInstituteFilter(e.target.value)} />
            </div>
          )}
        </FilterBar>

        <div className="p-3.5">
        {loading ? (
          <div className="flex justify-center items-center py-12"><LoadingSpinner /></div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-[#B3261E] dark:text-red-300">{error}</p>
            <Button onClick={fetchPayments} className="mt-4" variant="outline">Retry</Button>
          </div>
        ) : (
          <Table columns={columns} data={payments} emptyMessage="No salary payments found" showExport={false} onRowClick={(row) => navigate(ROUTES.SALARY.DETAIL(row.id))} />
        )}

        {pagination && (
          <div className="mt-3.5">
            <Pagination currentPage={pagination.page} totalPages={pagination.totalPages} totalItems={pagination.total} itemsPerPage={pagination.limit} onPageChange={setCurrentPage} />
          </div>
        )}
        </div>
      </Card>
    </div>
  );
}
