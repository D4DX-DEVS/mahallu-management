import { useState } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { accountingReportService } from '@/services/accountingReportService';

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
      setError(err.response?.data?.message || 'Failed to fetch consolidated report');
    } finally {
      setLoading(false);
    }
  };

  const institutes: InstituteRow[] = reportData?.institutes || [];
  const grandTotals = reportData?.grandTotals;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Consolidated Report</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Franchise-level view of all institutes' financial summary</p>
        </div>
        <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Consolidated Report' }]} />
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div className="w-44">
            <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="w-44">
            <Input label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <Button onClick={fetchReport} disabled={loading}>
            {loading ? 'Loading...' : 'Generate'}
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12"><LoadingSpinner /></div>
        ) : error ? (
          <div className="text-center py-12"><p className="text-red-600 dark:text-red-400">{error}</p></div>
        ) : !reportData ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Select a date range and click "Generate" to view the consolidated report
          </div>
        ) : (
          <>
            {/* Grand Totals */}
            {grandTotals && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <p className="text-sm text-green-600 dark:text-green-400">Total Income</p>
                  <p className="text-xl font-bold text-green-700 dark:text-green-300">₹{grandTotals.totalIncome.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <p className="text-sm text-red-600 dark:text-red-400">Total Expense</p>
                  <p className="text-xl font-bold text-red-700 dark:text-red-300">₹{grandTotals.totalExpense.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <p className="text-sm text-blue-600 dark:text-blue-400">Net Balance</p>
                  <p className="text-xl font-bold text-blue-700 dark:text-blue-300">₹{grandTotals.netBalance.toLocaleString()}</p>
                </div>
                <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <p className="text-sm text-purple-600 dark:text-purple-400">Bank Balance</p>
                  <p className="text-xl font-bold text-purple-700 dark:text-purple-300">₹{grandTotals.bankBalance.toLocaleString()}</p>
                </div>
              </div>
            )}

            {institutes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No data found for this period</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Institute</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Income</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Expense</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Net Balance</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Bank Balance</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Transactions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {institutes.map((inst) => (
                      <tr key={inst.instituteId} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{inst.instituteName}</td>
                        <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">₹{inst.totalIncome.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-right text-red-600 dark:text-red-400">₹{inst.totalExpense.toLocaleString()}</td>
                        <td className={`px-4 py-3 text-sm text-right font-medium ${inst.netBalance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                          ₹{inst.netBalance.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-purple-600 dark:text-purple-400">₹{inst.bankBalance.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">{inst.transactionCount}</td>
                      </tr>
                    ))}
                    {/* Grand Total Row */}
                    {grandTotals && (
                      <tr className="bg-gray-100 dark:bg-gray-800 font-bold">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">Grand Total</td>
                        <td className="px-4 py-3 text-sm text-right text-green-700 dark:text-green-300">₹{grandTotals.totalIncome.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-right text-red-700 dark:text-red-300">₹{grandTotals.totalExpense.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-right text-blue-700 dark:text-blue-300">₹{grandTotals.netBalance.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-right text-purple-700 dark:text-purple-300">₹{grandTotals.bankBalance.toLocaleString()}</td>
                        <td className="px-4 py-3 text-sm text-center text-gray-700 dark:text-gray-300">
                          {institutes.reduce((s, i) => s + i.transactionCount, 0)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
