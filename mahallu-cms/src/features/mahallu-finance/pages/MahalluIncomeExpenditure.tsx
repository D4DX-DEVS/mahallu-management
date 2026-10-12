import { useState } from 'react';
import { FiDollarSign, FiTrendingUp, FiTrendingDown } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Alert from '@/components/ui/Alert';
import FilterBar from '@/components/ui/FilterBar';
import StatCard from '@/components/ui/StatCard';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import DateRangePicker from '@/components/ui/DateRangePicker';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { accountingReportService } from '@/services/accountingReportService';
import { pct } from '@/utils/statSeries';
import { getFriendlyError } from '@/utils/apiMessages';

export default function MahalluIncomeExpenditure() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await accountingReportService.getIncomeExpenditure({ startDate, endDate, scope: 'mahallu' });
      setData(result);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load income & expenditure. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Mahallu Income & Expenditure" description="Income and expense statement for the Mahallu" />

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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <StatCard variant="inline" title="Total Income" value={`₹${(data.totalIncome || 0).toLocaleString()}`} tone="green" icon={<FiTrendingUp className="h-[17px] w-[17px]" />} />
                <StatCard variant="inline" viz={(data.totalIncome || 0) > 0 ? { type: 'bullet', percent: pct((data.totalExpense || 0), (data.totalIncome || 0)), target: 100, color: (data.totalExpense || 0) > (data.totalIncome || 0) ? '#B3261E' : '#04563A' } : undefined} summary={`Expense ₹${((data.totalExpense || 0)).toLocaleString()}, ${pct((data.totalExpense || 0), (data.totalIncome || 0))} percent of income`} title="Total Expense" value={`₹${(data.totalExpense || 0).toLocaleString()}`} tone="red" icon={<FiTrendingDown className="h-[17px] w-[17px]" />} />
                <StatCard variant="inline" title={(data.surplus || 0) >= 0 ? 'Surplus' : 'Deficit'} value={`₹${Math.abs(data.surplus || 0).toLocaleString()}`} tone={(data.surplus || 0) >= 0 ? 'lime' : 'red'} icon={<FiDollarSign className="h-[17px] w-[17px]" />} viz={(data.totalIncome || 0) + (data.totalExpense || 0) > 0 ? { type: 'pair', a: (data.totalIncome || 0), b: (data.totalExpense || 0), colorB: '#E0B400' } : undefined} summary={`Income ₹${((data.totalIncome || 0)).toLocaleString()} compared with expense ₹${((data.totalExpense || 0)).toLocaleString()}`} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Income */}
                <div>
                  <h3 className="text-sm font-semibold text-primary-700 dark:text-primary-400 uppercase mb-3">Income</h3>
                  {(data.income || []).map((ledger: any, i: number) => (
                    <div key={i} className="mb-4 border border-primary-200 dark:border-primary-800 rounded-lg overflow-hidden">
                      <div className="flex justify-between items-center px-4 py-3 bg-primary-50 dark:bg-primary-900/20">
                        <span className="text-sm font-semibold text-primary-800 dark:text-primary-300">{ledger.ledgerName || ledger.id?.ledgerName}</span>
                        <span className="text-sm font-bold text-primary-700">₹{(ledger.ledgerTotal || ledger.total || 0).toLocaleString()}</span>
                      </div>
                      {(ledger.categories || []).map((cat: any, j: number) => (
                        <div key={j} className="flex justify-between items-center px-4 py-2 border-t border-primary-100 dark:border-primary-900">
                          <span className="text-sm text-[#5B6963] dark:text-surface-muted pl-4">{cat.categoryName}</span>
                          <span className="text-sm text-[#3A4741] dark:text-surface-text">₹{(cat.total || 0).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  {!(data.income || []).length && <p className="text-sm text-[#98A59F]">No income recorded</p>}
                </div>

                {/* Expenses */}
                <div>
                  <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 uppercase mb-3">Expenses</h3>
                  {(data.expenses || []).map((ledger: any, i: number) => (
                    <div key={i} className="mb-4 border border-red-200 dark:border-red-800 rounded-lg overflow-hidden">
                      <div className="flex justify-between items-center px-4 py-3 bg-red-50 dark:bg-red-900/20">
                        <span className="text-sm font-semibold text-red-800 dark:text-red-300">{ledger.ledgerName || ledger.id?.ledgerName}</span>
                        <span className="text-sm font-bold text-red-700">₹{(ledger.ledgerTotal || ledger.total || 0).toLocaleString()}</span>
                      </div>
                      {(ledger.categories || []).map((cat: any, j: number) => (
                        <div key={j} className="flex justify-between items-center px-4 py-2 border-t border-red-100 dark:border-red-900">
                          <span className="text-sm text-[#5B6963] dark:text-surface-muted pl-4">{cat.categoryName}</span>
                          <span className="text-sm text-[#3A4741] dark:text-surface-text">₹{(cat.total || 0).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  {!(data.expenses || []).length && <p className="text-sm text-[#98A59F]">No expenses recorded</p>}
                </div>
              </div>
            </div>
          )}

        </div>
      </Card>
    </div>
  );
}
