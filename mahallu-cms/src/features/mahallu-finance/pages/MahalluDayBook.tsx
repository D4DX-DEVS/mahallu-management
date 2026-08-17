import { useState } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { accountingReportService, DayBookEntry } from '@/services/accountingReportService';

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
      setError(err.response?.data?.message || 'Failed to fetch day book');
    } finally {
      setLoading(false);
    }
  };

  const totalIncome = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const totalExpense = entries.filter(e => e.type === 'expense' || e.type === 'salary').reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mahallu Day Book</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Chronological record of Mahallu transactions</p>
        </div>
        <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Mahallu Finance', path: '/mahallu-finance/accounts' }, { label: 'Day Book' }]} />
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
        ) : entries.length === 0 ? (
          <p className="text-center py-12 text-gray-500">Select a date range and click "Generate"</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-green-600">Total Income</p>
                <p className="text-xl font-bold text-green-700">₹{totalIncome.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm text-red-600">Total Expense</p>
                <p className="text-xl font-bold text-red-700">₹{totalExpense.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-600">Net Balance</p>
                <p className="text-xl font-bold text-blue-700">₹{(totalIncome - totalExpense).toLocaleString()}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    {['Date', 'Description', 'Type', 'Ledger', 'Category', 'Amount'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {entries.map((entry, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">{new Date(entry.date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{entry.description}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${entry.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{entry.type}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{entry.ledgerName}</td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{entry.categoryName}</td>
                      <td className={`px-4 py-3 text-sm font-medium ${entry.type === 'income' ? 'text-green-600' : 'text-red-600'}`}>₹{entry.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
