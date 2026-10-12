import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { ROUTES } from '@/constants/routes';
import { salaryService } from '@/services/salaryService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import { getFriendlyError } from '@/utils/apiMessages';
import ScrollX from '@/features/_shared/ScrollX';

const MONTHS = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
  { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
  { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
];

const getMonthName = (month: number) => MONTHS.find(m => m.value === String(month))?.label || String(month);

interface SummaryItem {
  id: { instituteId?: string; month?: number; year?: number };
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
      setError(getFriendlyError(err, "Couldn't load salary summary. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  const grandTotal = summary.reduce((sum, s) => sum + (s.totalNetAmount || 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Salary Summary"
        description="Overview of salary expenditures"
        actions={<Link to={ROUTES.SALARY.LIST}><Button variant="secondary"><FiArrowLeft className="h-3.5 w-3.5" />Back</Button></Link>}
      />

      <Card padding="none" className="overflow-visible">
        <FilterBar>
          {!userInstituteId && (
            <div className="w-48">
              <Select options={[{ value: 'all', label: 'All Institutes' }, ...institutes.map(i => ({ value: i.id, label: i.name }))]} value={instituteFilter} onChange={(e) => setInstituteFilter(e.target.value)} />
            </div>
          )}
          <div className="w-28">
            <Select options={[{ value: 'all', label: 'All Years' }, ...years]} value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} />
          </div>
        </FilterBar>

        {loading ? (
          <div className="flex justify-center items-center py-12"><LoadingSpinner /></div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-[#B3261E] dark:text-red-300">{error}</p>
            <Button onClick={fetchSummary} className="mt-4" variant="secondary">Retry</Button>
          </div>
        ) : summary.length === 0 ? (
          <EmptyState title="No salary data found" description="No salary data found for the selected period" />
        ) : (
          <>
            <ScrollX className="p-3.5">
              <table className="w-full border-collapse text-[12.5px]">
                <thead className="bg-[#FAFCFB] dark:bg-surface-base/60">
                  <tr>
                    <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Period</th>
                    <th className="whitespace-nowrap px-3.5 py-2.5 text-right text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Payments</th>
                    <th className="whitespace-nowrap px-3.5 py-2.5 text-right text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Base Total</th>
                    <th className="whitespace-nowrap px-3.5 py-2.5 text-right text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Allowances</th>
                    <th className="whitespace-nowrap px-3.5 py-2.5 text-right text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Deductions</th>
                    <th className="whitespace-nowrap px-3.5 py-2.5 text-right text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Net Total</th>
                    <th className="whitespace-nowrap px-3.5 py-2.5 text-center text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Paid/Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft bg-white dark:divide-surface-border dark:bg-surface-card">
                  {summary.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[#F6FAF8] dark:hover:bg-surface-hover/60">
                      <td className="px-3.5 py-2 text-[12.5px] text-[#18231E] dark:text-surface-text">
                        {item.id?.month ? `${getMonthName(item.id.month)} ${item.id.year}` : item.instituteName || '-'}
                      </td>
                      <td className="px-3.5 py-2 text-[12.5px] text-right text-[#18231E] dark:text-surface-text">{item.totalPayments}</td>
                      <td className="px-3.5 py-2 text-[12.5px] text-right text-[#18231E] dark:text-surface-text">₹{item.totalBaseSalary.toLocaleString()}</td>
                      <td className="px-3.5 py-2 text-[12.5px] text-right text-primary-600 dark:text-primary-400">₹{item.totalAllowances.toLocaleString()}</td>
                      <td className="px-3.5 py-2 text-[12.5px] text-right text-[#B3261E] dark:text-red-300">₹{item.totalDeductions.toLocaleString()}</td>
                      <td className="px-3.5 py-2 text-[12.5px] text-right font-semibold text-[#18231E] dark:text-surface-text">₹{item.totalNetAmount.toLocaleString()}</td>
                      <td className="px-3.5 py-2 text-[12.5px] text-center">
                        <span className="text-primary-600">{item.paidCount}</span> / <span className="text-[#7A5B00] dark:text-secondary-300">{item.pendingCount}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[#FAFCFB] dark:bg-surface-base/60">
                  <tr>
                    <td className="px-3.5 py-2 text-[12.5px] font-bold text-[#18231E] dark:text-surface-text" colSpan={5}>Grand Total</td>
                    <td className="px-3.5 py-2 text-[12.5px] text-right font-bold text-[#18231E] dark:text-surface-text">₹{grandTotal.toLocaleString()}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </ScrollX>
          </>
        )}
      </Card>
    </div>
  );
}
