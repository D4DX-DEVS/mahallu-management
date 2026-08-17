import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { PageSkeleton } from '@/components/ui/Skeleton';
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

interface SummaryItem {
  _id: { instituteId?: string; month?: number; year?: number };
  totalPayments: number;
  totalBaseSalary: number;
  totalAllowances: number;
  totalDeductions: number;
  totalNetAmount: number;
  paidCount: number;
  pendingCount: number;
  instituteName?: string;
}

export default function SalarySummary() {
  const { currentInstituteId: userInstituteId } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryItem[]>([]);
  const [institutes, setInstitutes] = useState<{ id: string; name: string }[]>([]);
  const [instituteFilter, setInstituteFilter] = useState(userInstituteId || 'all');
  const [yearFilter, setYearFilter] = useState(String(new Date().getFullYear()));

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => ({ value: String(currentYear - i), label: String(currentYear - i) }));

  useEffect(() => {
    if (!userInstituteId) fetchInstitutes();
  }, []);

  useEffect(() => {
    fetchSummary();
  }, [instituteFilter, yearFilter]);

  const fetchInstitutes = async () => {
    try {
      const result = await instituteService.getAll({ limit: 1000 });
      setInstitutes(result.data.map((i: any) => ({ id: i.id, name: i.name })));
    } catch (err) { console.error('Error:', err); }
  };

  const fetchSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {};
      if (instituteFilter !== 'all') params.instituteId = instituteFilter;
      if (yearFilter !== 'all') params.year = Number(yearFilter);
      const data = await salaryService.getSummary(params);
      setSummary(data || []);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch salary summary');
    } finally {
      setLoading(false);
    }
  };

  const grandTotal = summary.reduce((sum, s) => sum + (s.totalNetAmount || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Salary Summary</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Overview of salary expenditures</p>
        </div>
        <div className="flex items-center gap-4">
          <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Salary', path: ROUTES.SALARY.LIST }, { label: 'Summary' }]} />
          <Link to={ROUTES.SALARY.LIST}><Button variant="outline"><FiArrowLeft className="h-4 w-4 mr-2" />Back</Button></Link>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {!userInstituteId && (
            <div className="w-48">
              <Select options={[{ value: 'all', label: 'All Institutes' }, ...institutes.map(i => ({ value: i.id, label: i.name }))]} value={instituteFilter} onChange={(e) => setInstituteFilter(e.target.value)} />
            </div>
          )}
          <div className="w-28">
            <Select options={[{ value: 'all', label: 'All Years' }, ...years]} value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} />
          </div>
        </div>

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchSummary} className="mt-4" variant="outline">Retry</Button>
          </div>
        ) : summary.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">No salary data found for the selected period</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Period</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Payments</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Base Total</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Allowances</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Deductions</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Net Total</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Paid/Pending</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {summary.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {item._id?.month ? `${getMonthName(item._id.month)} ${item._id.year}` : item.instituteName || '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">{item.totalPayments}</td>
                      <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">₹{item.totalBaseSalary.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">₹{item.totalAllowances.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-right text-red-600 dark:text-red-400">₹{item.totalDeductions.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 dark:text-gray-100">₹{item.totalNetAmount.toLocaleString()}</td>
                      <td className="px-4 py-3 text-sm text-center">
                        <span className="text-green-600">{item.paidCount}</span> / <span className="text-yellow-600">{item.pendingCount}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <td className="px-4 py-3 text-sm font-bold text-gray-900 dark:text-gray-100" colSpan={5}>Grand Total</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-gray-900 dark:text-gray-100">₹{grandTotal.toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
