import { useState } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { accountingReportService } from '@/services/accountingReportService';

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
      setError(err.response?.data?.message || 'Failed to fetch income & expenditure');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mahallu Income & Expenditure</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Income and expense statement for the Mahallu</p>
        </div>
        <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Mahallu Finance', path: '/mahallu-finance/accounts' }, { label: 'Income & Expenditure' }]} />
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div className="w-44"><Input label="Start Date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
          <div className="w-44"><Input label="End Date" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
          <Button onClick={fetchData} disabled={loading}>{loading ? 'Loading...' : 'Generate'}</Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : error ? (
          <p className="text-center py-8 text-red-600">{error}</p>
        ) : !data ? (
          <p className="text-center py-12 text-gray-500">Select a date range and click "Generate"</p>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-green-600">Total Income</p>
                <p className="text-2xl font-bold text-green-700">₹{(data.totalIncome || 0).toLocaleString()}</p>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm text-red-600">Total Expense</p>
                <p className="text-2xl font-bold text-red-700">₹{(data.totalExpense || 0).toLocaleString()}</p>
              </div>
              <div className={`p-4 rounded-lg ${(data.surplus || 0) >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                <p className={`text-sm ${(data.surplus || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{(data.surplus || 0) >= 0 ? 'Surplus' : 'Deficit'}</p>
                <p className={`text-2xl font-bold ${(data.surplus || 0) >= 0 ? 'text-green-700' : 'text-red-700'}`}>₹{Math.abs(data.surplus || 0).toLocaleString()}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Income */}
              <div>
                <h3 className="text-sm font-semibold text-green-700 dark:text-green-400 uppercase mb-3">Income</h3>
                {(data.income || []).map((ledger: any, i: number) => (
                  <div key={i} className="mb-4 border border-green-200 dark:border-green-800 rounded-lg overflow-hidden">
                    <div className="flex justify-between items-center px-4 py-3 bg-green-50 dark:bg-green-900/20">
                      <span className="text-sm font-semibold text-green-800 dark:text-green-300">{ledger.ledgerName || ledger._id?.ledgerName}</span>
                      <span className="text-sm font-bold text-green-700">₹{(ledger.ledgerTotal || ledger.total || 0).toLocaleString()}</span>
                    </div>
                    {(ledger.categories || []).map((cat: any, j: number) => (
                      <div key={j} className="flex justify-between items-center px-4 py-2 border-t border-green-100 dark:border-green-900">
                        <span className="text-sm text-gray-600 dark:text-gray-400 pl-4">{cat.categoryName}</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">₹{(cat.total || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ))}
                {!(data.income || []).length && <p className="text-sm text-gray-400">No income recorded</p>}
              </div>

              {/* Expenses */}
              <div>
                <h3 className="text-sm font-semibold text-red-700 dark:text-red-400 uppercase mb-3">Expenses</h3>
                {(data.expenses || []).map((ledger: any, i: number) => (
                  <div key={i} className="mb-4 border border-red-200 dark:border-red-800 rounded-lg overflow-hidden">
                    <div className="flex justify-between items-center px-4 py-3 bg-red-50 dark:bg-red-900/20">
                      <span className="text-sm font-semibold text-red-800 dark:text-red-300">{ledger.ledgerName || ledger._id?.ledgerName}</span>
                      <span className="text-sm font-bold text-red-700">₹{(ledger.ledgerTotal || ledger.total || 0).toLocaleString()}</span>
                    </div>
                    {(ledger.categories || []).map((cat: any, j: number) => (
                      <div key={j} className="flex justify-between items-center px-4 py-2 border-t border-red-100 dark:border-red-900">
                        <span className="text-sm text-gray-600 dark:text-gray-400 pl-4">{cat.categoryName}</span>
                        <span className="text-sm text-gray-700 dark:text-gray-300">₹{(cat.total || 0).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ))}
                {!(data.expenses || []).length && <p className="text-sm text-gray-400">No expenses recorded</p>}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
