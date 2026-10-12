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
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { accountingReportService, BalanceSheetData } from '@/services/accountingReportService';
import { pct } from '@/utils/statSeries';
import { getFriendlyError } from '@/utils/apiMessages';

export default function MahalluBalanceSheet() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await accountingReportService.getBalanceSheet({ startDate, endDate, scope: 'mahallu' });
      setData(result);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load balance sheet. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Mahallu Balance Sheet" description="Financial position of the Mahallu" />

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
          ) : !data ? (
            <EmptyState title="Nothing to show yet" description='Select a date range and click "Generate"' />
          ) : (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
                <StatCard variant="inline" title="Bank Balance" value={`₹${(data.totalBankBalance || 0).toLocaleString()}`} tone="neutral" icon={<FiDollarSign className="h-[17px] w-[17px]" />} />
                <StatCard variant="inline" title="Total Income" value={`₹${(data.totalIncome || 0).toLocaleString()}`} tone="green" icon={<FiTrendingUp className="h-[17px] w-[17px]" />} />
                <StatCard variant="inline" viz={(data.totalIncome || 0) > 0 ? { type: 'bullet', percent: pct((data.totalExpense || 0), (data.totalIncome || 0)), target: 100, color: (data.totalExpense || 0) > (data.totalIncome || 0) ? '#B3261E' : '#04563A' } : undefined} summary={`Expense ₹${((data.totalExpense || 0)).toLocaleString()}, ${pct((data.totalExpense || 0), (data.totalIncome || 0))} percent of income`} title="Total Expense" value={`₹${(data.totalExpense || 0).toLocaleString()}`} tone="red" icon={<FiTrendingDown className="h-[17px] w-[17px]" />} />
                <StatCard variant="inline" title="Net Balance" value={`₹${(data.netBalance || 0).toLocaleString()}`} tone={(data.netBalance || 0) >= 0 ? 'lime' : 'red'} icon={<FiDollarSign className="h-[17px] w-[17px]" />} viz={(data.totalIncome || 0) + (data.totalExpense || 0) > 0 ? { type: 'pair', a: (data.totalIncome || 0), b: (data.totalExpense || 0), colorB: '#E0B400' } : undefined} summary={`Income ₹${((data.totalIncome || 0)).toLocaleString()} compared with expense ₹${((data.totalExpense || 0)).toLocaleString()}`} />
              </div>

              {/* Bank Accounts */}
              {data.bankBalances.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[#3A4741] dark:text-surface-text uppercase mb-3">Bank Accounts (Assets)</h3>
                  <div className="divide-y divide-line-soft dark:divide-surface-border border border-line dark:border-surface-border rounded-lg">
                    {data.bankBalances.map((b, i) => (
                      <div key={i} className="flex justify-between items-center px-4 py-3">
                        <span className="text-sm text-[#3A4741] dark:text-surface-text">{b.ledgerName}</span>
                        <span className="text-sm font-medium text-blue-700">₹{b.balance.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Income */}
              {data.incomeByCategory.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[#3A4741] dark:text-surface-text uppercase mb-3">Income</h3>
                  <div className="divide-y divide-line-soft dark:divide-surface-border border border-line dark:border-surface-border rounded-lg">
                    {data.incomeByCategory.map((item, i) => (
                      <div key={i} className="flex justify-between items-center px-4 py-3">
                        <span className="text-sm text-[#3A4741] dark:text-surface-text">{item.category}</span>
                        <span className="text-sm font-medium text-primary-700">₹{item.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expenses */}
              {data.expenseByCategory.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[#3A4741] dark:text-surface-text uppercase mb-3">Expenses</h3>
                  <div className="divide-y divide-line-soft dark:divide-surface-border border border-line dark:border-surface-border rounded-lg">
                    {data.expenseByCategory.map((item, i) => (
                      <div key={i} className="flex justify-between items-center px-4 py-3">
                        <span className="text-sm text-[#3A4741] dark:text-surface-text">{item.category}</span>
                        <span className="text-sm font-medium text-red-700">₹{item.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </Card>
    </div>
  );
}
