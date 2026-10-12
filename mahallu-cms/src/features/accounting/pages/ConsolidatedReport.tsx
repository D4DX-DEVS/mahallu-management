import { useState } from 'react';
import { FiTrendingUp, FiTrendingDown, FiDollarSign } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Alert from '@/components/ui/Alert';
import FilterBar from '@/components/ui/FilterBar';
import StatCard from '@/components/ui/StatCard';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import DateRangePicker from '@/components/ui/DateRangePicker';
import { PersonCell } from '@/components/ui/Avatar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { accountingReportService } from '@/services/accountingReportService';
import { pct } from '@/utils/statSeries';
import { getFriendlyError } from '@/utils/apiMessages';
import ScrollX from '@/features/_shared/ScrollX';

interface InstituteRow {
  instituteId: string;
  instituteName: string;
  totalIncome: number;
  totalExpense: number;
  netBalance: number;
  bankBalance: number;
  transactionCount: number;
}

export default function ConsolidatedReport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 11); d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<any>(null);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await accountingReportService.getConsolidatedReport({ startDate, endDate });
      setReportData(data);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load consolidated report. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  const institutes: InstituteRow[] = reportData?.institutes || [];
  const grandTotals = reportData?.grandTotals;

  return (
    <div className="space-y-4">
      <PageHeader title="Consolidated Report" description="Franchise-level view of all institutes' financial summary" />

      <Card padding="none" className="overflow-visible">
        <FilterBar className="items-end">
          <div className="w-72 max-sm:w-full">
            <DateRangePicker label="Date range" from={startDate} to={endDate} onChange={(f, t) => { setStartDate(f); setEndDate(t); }} />
          </div>
          <Button onClick={fetchReport} disabled={loading}>
            {loading ? 'Loading...' : 'Generate'}
          </Button>
        </FilterBar>

        <div className="p-3.5">
          {loading ? (
            <div className="flex justify-center items-center py-12"><LoadingSpinner /></div>
          ) : error ? (
            <Alert tone="danger">{error}</Alert>
          ) : !reportData ? (
            <EmptyState title="Nothing to show yet" description='Select a date range and click "Generate" to view the consolidated report' />
          ) : (
            <>
              {/* Grand Totals */}
              {grandTotals && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 mb-4">
                  <StatCard variant="inline" title="Total Income" value={`₹${grandTotals.totalIncome.toLocaleString()}`} tone="green" icon={<FiTrendingUp className="h-[17px] w-[17px]" />} />
                  <StatCard variant="inline" viz={grandTotals.totalIncome > 0 ? { type: 'bullet', percent: pct(grandTotals.totalExpense, grandTotals.totalIncome), target: 100, color: grandTotals.totalExpense > grandTotals.totalIncome ? '#B3261E' : '#04563A' } : undefined} summary={`Expense ₹${(grandTotals.totalExpense).toLocaleString()}, ${pct(grandTotals.totalExpense, grandTotals.totalIncome)} percent of income`} title="Total Expense" value={`₹${grandTotals.totalExpense.toLocaleString()}`} tone="red" icon={<FiTrendingDown className="h-[17px] w-[17px]" />} />
                  <StatCard variant="inline" viz={grandTotals.totalIncome + grandTotals.totalExpense > 0 ? { type: 'pair', a: grandTotals.totalIncome, b: grandTotals.totalExpense, colorB: '#E0B400' } : undefined} summary={`Income ₹${(grandTotals.totalIncome).toLocaleString()} compared with expense ₹${(grandTotals.totalExpense).toLocaleString()}`} title="Net Balance" value={`₹${grandTotals.netBalance.toLocaleString()}`} tone="neutral" icon={<FiDollarSign className="h-[17px] w-[17px]" />} />
                  <StatCard variant="inline" title="Bank Balance" value={`₹${grandTotals.bankBalance.toLocaleString()}`} tone="neutral" icon={<FiDollarSign className="h-[17px] w-[17px]" />} />
                </div>
              )}

              {institutes.length === 0 ? (
                <EmptyState title="Nothing to show yet" description='No data found for this period' />
              ) : (
                <ScrollX>
                  <table className="w-full border-collapse text-[12.5px]">
                    <thead className="bg-[#FAFCFB] dark:bg-surface-base/60">
                      <tr>
                        <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Institute</th>
                        <th className="whitespace-nowrap px-3.5 py-2.5 text-right text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Income</th>
                        <th className="whitespace-nowrap px-3.5 py-2.5 text-right text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Expense</th>
                        <th className="whitespace-nowrap px-3.5 py-2.5 text-right text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Net Balance</th>
                        <th className="whitespace-nowrap px-3.5 py-2.5 text-right text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Bank Balance</th>
                        <th className="whitespace-nowrap px-3.5 py-2.5 text-center text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Transactions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-soft bg-white dark:divide-surface-border dark:bg-surface-card">
                      {institutes.map((inst) => (
                        <tr key={inst.instituteId} className="hover:bg-[#F6FAF8] dark:hover:bg-surface-hover/60">
                          <td className="px-3.5 py-2 text-[12.5px] font-medium text-[#18231E] dark:text-surface-text"><PersonCell name={inst.instituteName} size={24} /></td>
                          <td className="px-3.5 py-2 text-[12.5px] text-right text-primary-600 dark:text-primary-400">₹{inst.totalIncome.toLocaleString()}</td>
                          <td className="px-3.5 py-2 text-[12.5px] text-right text-[#B3261E] dark:text-red-300">₹{inst.totalExpense.toLocaleString()}</td>
                          <td className={`px-3.5 py-2 text-[12.5px] text-right font-medium ${inst.netBalance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                            ₹{inst.netBalance.toLocaleString()}
                          </td>
                          <td className="px-3.5 py-2 text-[12.5px] text-right text-purple-600 dark:text-purple-400">₹{inst.bankBalance.toLocaleString()}</td>
                          <td className="px-3.5 py-2 text-[12.5px] text-center text-[#5B6963] dark:text-surface-muted">{inst.transactionCount}</td>
                        </tr>
                      ))}
                      {/* Grand Total Row */}
                      {grandTotals && (
                        <tr className="bg-[#F1F6F3] font-bold dark:bg-surface-raised">
                          <td className="px-3.5 py-2 text-[12.5px] text-[#18231E] dark:text-surface-text">Grand Total</td>
                          <td className="px-3.5 py-2 text-[12.5px] text-right text-primary-700 dark:text-primary-300">₹{grandTotals.totalIncome.toLocaleString()}</td>
                          <td className="px-3.5 py-2 text-[12.5px] text-right text-red-700 dark:text-red-300">₹{grandTotals.totalExpense.toLocaleString()}</td>
                          <td className="px-3.5 py-2 text-[12.5px] text-right text-blue-700 dark:text-blue-300">₹{grandTotals.netBalance.toLocaleString()}</td>
                          <td className="px-3.5 py-2 text-[12.5px] text-right text-purple-700 dark:text-purple-300">₹{grandTotals.bankBalance.toLocaleString()}</td>
                          <td className="px-3.5 py-2 text-[12.5px] text-center text-[#3A4741] dark:text-surface-text">
                            {institutes.reduce((s, i) => s + i.transactionCount, 0)}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </ScrollX>
              )}
            </>
          )}

        </div>
      </Card>
    </div>
  );
}
