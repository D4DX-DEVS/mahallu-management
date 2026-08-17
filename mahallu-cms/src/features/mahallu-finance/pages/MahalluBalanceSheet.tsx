import { useState } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { accountingReportService, BalanceSheetData } from '@/services/accountingReportService';

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
      setError(err.response?.data?.message || 'Failed to fetch balance sheet');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mahallu Balance Sheet</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Financial position of the Mahallu</p>
        </div>
        <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Mahallu Finance', path: '/mahallu-finance/accounts' }, { label: 'Balance Sheet' }]} />
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div className="w-44"><Input label="Start Date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
          <div className="w-44"><Input label="End Date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
          <Button onClick={fetchData} disabled={loading}>{loading ? 'Loading...' : 'Generate'}</Button>
        </div>

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <p className="text-center py-8 text-red-600">{error}</p>
        ) : !data ? (
          <p className="text-center py-12 text-gray-500">Select a date range and click "Generate"</p>
        ) : (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-600">Bank Balance</p>
                <p className="text-xl font-bold text-blue-700">₹{(data.totalBankBalance || 0).toLocaleString()}</p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-green-600">Total Income</p>
                <p className="text-xl font-bold text-green-700">₹{(data.totalIncome || 0).toLocaleString()}</p>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm text-red-600">Total Expense</p>
                <p className="text-xl font-bold text-red-700">₹{(data.totalExpense || 0).toLocaleString()}</p>
              </div>
              <div className={`p-4 rounded-lg ${(data.netBalance || 0) >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                <p className={`text-sm ${(data.netBalance || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>Net Balance</p>
                <p className={`text-xl font-bold ${(data.netBalance || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>₹{(data.netBalance || 0).toLocaleString()}</p>
              </div>
            </div>

            {/* Bank Accounts */}
            {data.bankBalances.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase mb-3">Bank Accounts (Assets)</h3>
                <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
                  {data.bankBalances.map((b, i) => (
                    <div key={i} className="flex justify-between items-center px-4 py-3">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{b.ledgerName}</span>
                      <span className="text-sm font-medium text-blue-700">₹{b.balance.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Income */}
            {data.incomeByCategory.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase mb-3">Income</h3>
                <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
                  {data.incomeByCategory.map((item, i) => (
                    <div key={i} className="flex justify-between items-center px-4 py-3">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{item.category}</span>
                      <span className="text-sm font-medium text-green-700">₹{item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Expenses */}
            {data.expenseByCategory.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase mb-3">Expenses</h3>
                <div className="divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
                  {data.expenseByCategory.map((item, i) => (
                    <div key={i} className="flex justify-between items-center px-4 py-3">
                      <span className="text-sm text-gray-700 dark:text-gray-300">{item.category}</span>
                      <span className="text-sm font-medium text-red-700">₹{item.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
