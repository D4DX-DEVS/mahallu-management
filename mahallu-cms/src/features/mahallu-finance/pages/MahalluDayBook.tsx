import { useState } from 'react';
import { FiTrendingUp, FiTrendingDown, FiDollarSign } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Badge from '@/components/ui/Badge';
import Alert from '@/components/ui/Alert';
import FilterBar from '@/components/ui/FilterBar';
import StatCard from '@/components/ui/StatCard';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import DateRangePicker from '@/components/ui/DateRangePicker';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { accountingReportService, DayBookEntry } from '@/services/accountingReportService';
import { pct } from '@/utils/statSeries';
import { getFriendlyError } from '@/utils/apiMessages';
import ScrollX from '@/features/_shared/ScrollX';

export default function MahalluDayBook() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<DayBookEntry[]>([]);
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await accountingReportService.getDayBook({ startDate, endDate, scope: 'mahallu' });
      setEntries(data || []);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load day book. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  const totalIncome = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const totalExpense = entries.filter(e => e.type === 'expense' || e.type === 'salary').reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Mahallu Day Book" description="Chronological record of Mahallu transactions" />

      <Card padding="none" className="overflow-visible">
        <FilterBar className="items-end">
          <div className="w-72 max-sm:w-full">
            <DateRangePicker label="Date range" from={startDate} to={endDate} onChange={(f, t) => { setStartDate(f); setEndDate(t); }} />
          </div>
          <Button onClick={fetchData} disabled={loading}>{loading ? 'Loading...' : 'Generate'}</Button>
        </FilterBar>

        <div className="p-3.5">
          {loading ? (
            <div className="flex justify-center py-12"><LoadingSpinner /></div>
          ) : error ? (
            <Alert tone="danger">{error}</Alert>
          ) : entries.length === 0 ? (
            <EmptyState title="Nothing to show yet" description='Select a date range and click "Generate"' />
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
                      {['Date', 'Description', 'Type', 'Ledger', 'Category', 'Amount'].map(h => (
                        <th key={h} className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft dark:divide-surface-border">
                    {entries.map((entry, i) => (
                      <tr key={i} className="hover:bg-[#F6FAF8] dark:hover:bg-surface-hover/60">
                        <td className="px-3.5 py-2 text-[12.5px] text-[#18231E] dark:text-surface-text whitespace-nowrap">{new Date(entry.date).toLocaleDateString()}</td>
                        <td className="px-3.5 py-2 text-[12.5px] text-[#18231E] dark:text-surface-text">{entry.description}</td>
                        <td className="px-3.5 py-2">
                          <Badge variant={entry.type === 'income' ? 'success' : 'danger'} dot className="capitalize">{entry.type}</Badge>
                        </td>
                        <td className="px-3.5 py-2 text-[12.5px] text-[#5B6963] dark:text-surface-muted">{entry.ledgerName}</td>
                        <td className="px-3.5 py-2 text-[12.5px] text-[#5B6963] dark:text-surface-muted">{entry.categoryName}</td>
                        <td className={`px-3.5 py-2 text-[12.5px] font-medium ${entry.type === 'income' ? 'text-primary-600' : 'text-red-600'}`}>₹{entry.amount.toLocaleString()}</td>
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
