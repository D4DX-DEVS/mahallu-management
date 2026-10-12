import { useState } from 'react';
import { FiDollarSign, FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
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
import { accountingReportService, TrialBalanceEntry } from '@/services/accountingReportService';
import { getFriendlyError } from '@/utils/apiMessages';
import ScrollX from '@/features/_shared/ScrollX';

export default function MahalluTrialBalance() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<TrialBalanceEntry[]>([]);
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await accountingReportService.getTrialBalance({ startDate, endDate, scope: 'mahallu' });
      setEntries(data || []);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load trial balance. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Mahallu Trial Balance" description="Summary of all Mahallu ledger balances" />

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
                <StatCard variant="inline" title="Total Debit (Expense)" value={`₹${totalDebit.toLocaleString()}`} tone="red" icon={<FiTrendingDown className="h-[17px] w-[17px]" />} />
                <StatCard variant="inline" title="Total Credit (Income)" value={`₹${totalCredit.toLocaleString()}`} tone="green" icon={<FiTrendingUp className="h-[17px] w-[17px]" />} />
                <StatCard variant="inline" title="Difference" value={`₹${Math.abs(totalCredit - totalDebit).toLocaleString()}`} tone={Math.abs(totalCredit - totalDebit) < 0.01 ? 'lime' : 'gold'} icon={<FiDollarSign className="h-[17px] w-[17px]" />} viz={totalDebit + totalCredit > 0 ? { type: 'pair', a: totalCredit, b: totalDebit, colorB: '#E0B400' } : undefined} summary={`Credit ₹${totalCredit.toLocaleString()} compared with debit ₹${totalDebit.toLocaleString()}`} />
              </div>
              <ScrollX>
                <table className="w-full border-collapse text-[12.5px]">
                  <thead className="bg-[#FAFCFB] dark:bg-surface-base/60">
                    <tr>
                      {['Ledger', 'Type', 'Debit', 'Credit'].map(h => (
                        <th key={h} className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft dark:divide-surface-border">
                    {entries.map((entry, i) => (
                      <tr key={i} className="hover:bg-[#F6FAF8] dark:hover:bg-surface-hover/60">
                        <td className="px-3.5 py-2 text-[12.5px] font-medium text-[#18231E] dark:text-surface-text">{entry.ledgerName}</td>
                        <td className="px-3.5 py-2">
                          <Badge variant={entry.type === 'income' ? 'success' : 'danger'} dot className="capitalize">{entry.type}</Badge>
                        </td>
                        <td className="px-3.5 py-2 text-[12.5px] text-red-600">{entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : '-'}</td>
                        <td className="px-3.5 py-2 text-[12.5px] text-primary-600">{entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : '-'}</td>
                      </tr>
                    ))}
                    <tr className="bg-[#FAFCFB] font-semibold dark:bg-surface-base/60">
                      <td className="px-3.5 py-2 text-[12.5px] text-[#18231E] dark:text-surface-text" colSpan={2}>Total</td>
                      <td className="px-3.5 py-2 text-[12.5px] text-red-700">₹{totalDebit.toLocaleString()}</td>
                      <td className="px-3.5 py-2 text-[12.5px] text-primary-700">₹{totalCredit.toLocaleString()}</td>
                    </tr>
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
