import { useState } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { accountingReportService, TrialBalanceEntry } from '@/services/accountingReportService';

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
      setError(err.response?.data?.message || 'Failed to fetch trial balance');
    } finally {
      setLoading(false);
    }
  };

  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mahallu Trial Balance</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Summary of all Mahallu ledger balances</p>
        </div>
        <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Mahallu Finance', path: '/mahallu-finance/accounts' }, { label: 'Trial Balance' }]} />
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
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm text-red-600">Total Debit (Expense)</p>
                <p className="text-xl font-bold text-red-700">₹{totalDebit.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-green-600">Total Credit (Income)</p>
                <p className="text-xl font-bold text-green-700">₹{totalCredit.toLocaleString()}</p>
              </div>
              <div className={`p-4 rounded-lg ${Math.abs(totalCredit - totalDebit) < 0.01 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-yellow-50 dark:bg-yellow-900/20'}`}>
                <p className={`text-sm ${Math.abs(totalCredit - totalDebit) < 0.01 ? 'text-green-600' : 'text-yellow-600'}`}>Difference</p>
                <p className={`text-xl font-bold ${Math.abs(totalCredit - totalDebit) < 0.01 ? 'text-green-700' : 'text-yellow-700'}`}>₹{Math.abs(totalCredit - totalDebit).toLocaleString()}</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    {['Ledger', 'Type', 'Debit', 'Credit'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {entries.map((entry, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{entry.ledgerName}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${entry.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{entry.type}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-red-600">{entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : '-'}</td>
                      <td className="px-4 py-3 text-sm text-green-600">{entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : '-'}</td>
                    </tr>
                  ))}
                  <tr className="bg-gray-50 dark:bg-gray-800 font-semibold">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100" colSpan={2}>Total</td>
                    <td className="px-4 py-3 text-sm text-red-700">₹{totalDebit.toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm text-green-700">₹{totalCredit.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
