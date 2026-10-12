import { useState, useEffect } from 'react';
import { FiTrendingUp, FiTrendingDown, FiDollarSign } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Alert from '@/components/ui/Alert';
import FilterBar from '@/components/ui/FilterBar';
import StatCard from '@/components/ui/StatCard';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import DateRangePicker from '@/components/ui/DateRangePicker';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { accountingReportService, DayBookEntry } from '@/services/accountingReportService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import { pct } from '@/utils/statSeries';
import { getFriendlyError } from '@/utils/apiMessages';
import ScrollX from '@/features/_shared/ScrollX';

export default function DayBook() {
  const { currentInstituteId: userInstituteId } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<DayBookEntry[]>([]);
  const [institutes, setInstitutes] = useState<{ id: string; name: string }[]>([]);
  const [instituteFilter, setInstituteFilter] = useState(userInstituteId || 'all');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!userInstituteId) fetchInstitutes();
  }, []);

  const fetchInstitutes = async () => {
    try {
      const result = await instituteService.getAll({ limit: 1000 });
      setInstitutes(result.data.map((i: any) => ({ id: i.id, name: i.name })));
    } catch (err) { console.error('Error:', err); }
  };

  const fetchDayBook = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { startDate, endDate };
      if (instituteFilter !== 'all') params.instituteId = instituteFilter;
      const data = await accountingReportService.getDayBook(params);
      setEntries(data || []);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load day book. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  const totalIncome = entries.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = entries.filter(e => e.type === 'expense' || e.type === 'salary').reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Day Book" description="Chronological record of all transactions" />

      <Card padding="none" className="overflow-visible">
        <FilterBar className="items-end">
          <div className="w-72 max-sm:w-full">
            <DateRangePicker label="Date range" from={startDate} to={endDate} onChange={(f, t) => { setStartDate(f); setEndDate(t); }} />
          </div>
          {!userInstituteId && (
            <div className="w-48">
              <Select
                label="Institute"
                options={[{ value: 'all', label: 'All Institutes' }, ...institutes.map(i => ({ value: i.id, label: i.name }))]}
                value={instituteFilter}
                onChange={(e) => setInstituteFilter(e.target.value)}
              />
            </div>
          )}
          <Button onClick={fetchDayBook} disabled={loading}>
            {loading ? 'Loading...' : 'Generate'}
          </Button>
        </FilterBar>

        <div className="p-3.5">
          {loading ? (
            <div className="flex justify-center items-center py-12"><LoadingSpinner /></div>
          ) : error ? (
            <Alert tone="danger">{error}</Alert>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-[#7B8983] dark:text-surface-muted">
              {startDate ? 'No entries found for the selected period. Click "Generate" to load data.' : 'Select a date range and click "Generate"'}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4">
                <StatCard variant="inline" title="Total Income" value={`₹${totalIncome.toLocaleString()}`} tone="green" icon={<FiTrendingUp className="h-[17px] w-[17px]" />} />
                <StatCard variant="inline" viz={totalIncome > 0 ? { type: 'bullet', percent: pct(totalExpense, totalIncome), target: 100, color: totalExpense > totalIncome ? '#B3261E' : '#04563A' } : undefined} summary={`Expense ₹${(totalExpense).toLocaleString()}, ${pct(totalExpense, totalIncome)} percent of income`} title="Total Expense" value={`₹${totalExpense.toLocaleString()}`} tone="red" icon={<FiTrendingDown className="h-[17px] w-[17px]" />} />
                <StatCard variant="inline" viz={totalIncome + totalExpense > 0 ? { type: 'pair', a: totalIncome, b: totalExpense, colorB: '#E0B400' } : undefined} summary={`Income ₹${(totalIncome).toLocaleString()} compared with expense ₹${(totalExpense).toLocaleString()}`} title="Net Balance" value={`₹${(totalIncome - totalExpense).toLocaleString()}`} tone="neutral" icon={<FiDollarSign className="h-[17px] w-[17px]" />} />
              </div>

              <ScrollX>
                <table className="w-full border-collapse text-[12.5px]">
                  <thead className="bg-[#FAFCFB] dark:bg-surface-base/60">
                    <tr>
                      <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Date</th>
                      <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Description</th>
                      <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Type</th>
                      <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Ledger/Category</th>
                      <th className="whitespace-nowrap px-3.5 py-2.5 text-right text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft bg-white dark:divide-surface-border dark:bg-surface-card">
                    {entries.map((entry, idx) => (
                      <tr key={idx} className="hover:bg-[#F6FAF8] dark:hover:bg-surface-hover/60">
                        <td className="px-3.5 py-2 text-[12.5px] text-[#18231E] dark:text-surface-text whitespace-nowrap">
                          {new Date(entry.date).toLocaleDateString()}
                        </td>
                        <td className="px-3.5 py-2 text-[12.5px] text-[#18231E] dark:text-surface-text">
                          {entry.description}
                          {entry.employeeName && <span className="text-[#7B8983] dark:text-surface-muted ml-1">({entry.employeeName})</span>}
                        </td>
                        <td className="px-3.5 py-2 text-[12.5px]">
                          <Badge variant={entry.type === 'income' ? 'success' : entry.type === 'salary' ? 'info' : 'danger'} dot className="capitalize">{entry.type}</Badge>
                        </td>
                        <td className="px-3.5 py-2 text-[12.5px] text-[#5B6963] dark:text-surface-muted">
                          {entry.ledgerName || entry.categoryName || '-'}
                        </td>
                        <td className={`px-3.5 py-2 text-[12.5px] text-right font-medium ${
                          entry.type === 'income' ? 'text-primary-600 dark:text-primary-400' : 'text-[#B3261E] dark:text-red-300'
                        }`}>
                          {entry.type === 'income' ? '+' : '-'}₹{entry.amount.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollX>
            </>
          )}

        </div>
      </Card>
    </div>
  );
}
