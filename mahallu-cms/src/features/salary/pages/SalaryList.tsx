import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FiEye, FiX, FiDollarSign, FiCheckCircle, FiClock } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { SalaryPayment } from '@/types';
import { ROUTES } from '@/constants/routes';
import { salaryService } from '@/services/salaryService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';

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
      setError(err.response?.data?.message || 'Failed to fetch salary payments');
    } finally {
      setLoading(false);
    }
  };

  const columns: TableColumn<SalaryPayment>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'employeeId', label: 'Employee', render: (emp) => (typeof emp === 'object' && emp?.name) ? emp.name : (emp || '-') },
    { key: 'month', label: 'Period', render: (_, row) => `${getMonthName(row.month)} ${row.year}` },
    { key: 'baseSalary', label: 'Base', render: (v) => `₹${Number(v || 0).toLocaleString()}` },
    { key: 'netAmount', label: 'Net Amount', render: (v) => <span className="font-semibold">₹{Number(v || 0).toLocaleString()}</span> },
    { key: 'paymentMethod', label: 'Method', render: (v) => v || '-' },
    {
      key: 'status',
      label: 'Status',
      render: (status) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            : status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
            : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
        }`}>
          {status || 'pending'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <button onClick={(e) => { e.stopPropagation(); navigate(ROUTES.SALARY.DETAIL(row.id)); }} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400">
          <FiEye className="h-4 w-4" />
        </button>
      ),
    },
  ];

  const totalPaid = payments.filter(p => p.status === 'paid').reduce((sum, p) => sum + (p.netAmount || 0), 0);
  const totalPending = payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + (p.netAmount || 0), 0);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => ({ value: String(currentYear - i), label: String(currentYear - i) }));

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Salary Payments</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Manage employee salary payments</p>
          </div>
          <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Salary' }]} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard title="Total Payments" value={pagination?.total || payments.length} icon={<FiDollarSign className="h-5 w-5" />} />
          <StatCard title="Total Paid" value={`₹${totalPaid.toLocaleString()}`} icon={<FiCheckCircle className="h-5 w-5" />} />
          <StatCard title="Total Pending" value={`₹${totalPending.toLocaleString()}`} icon={<FiClock className="h-5 w-5" />} />
        </div>
      </div>

      <Card>
        <TableToolbar
          searchQuery=""
          onSearchChange={() => {}}
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
          isFilterVisible={isFilterVisible}
          hasFilters={true}
          onRefresh={fetchPayments}
          actionButtons={
            <div className="flex gap-2">
              <Link to={ROUTES.SALARY.SUMMARY}><Button size="md" variant="outline">Summary</Button></Link>
              <Link to={ROUTES.SALARY.CREATE}><Button size="md">+ New Payment</Button></Link>
            </div>
          }
        />

        {isFilterVisible && (
          <div className="relative flex flex-wrap items-center gap-4 mb-6 p-4 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700">
            <button onClick={() => setIsFilterVisible(false)} className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"><FiX className="h-4 w-4" /></button>
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
          </div>
        )}

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchPayments} className="mt-4" variant="outline">Retry</Button>
          </div>
        ) : (
          <Table columns={columns} data={payments} emptyMessage="No salary payments found" showExport={false} onRowClick={(row) => navigate(ROUTES.SALARY.DETAIL(row.id))} />
        )}

        {pagination && (
          <div className="mt-4">
            <Pagination currentPage={pagination.page} totalPages={pagination.totalPages} totalItems={pagination.total} itemsPerPage={pagination.limit} onPageChange={setCurrentPage} />
          </div>
        )}
      </Card>
    </div>
  );
}
