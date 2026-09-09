import { useState } from 'react';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { accountingReportService } from '@/services/accountingReportService';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

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
    const d = new Date();
    d.setMonth(d.getMonth() - 11);
    d.setDate(1);
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
      setError(loadErrorMessage(err, 'consolidated report'));
    } finally {
      setLoading(false);
    }
  };

  const institutes: InstituteRow[] = reportData?.institutes || [];
  const grandTotals = reportData?.grandTotals;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Consolidated Report"
        description="Franchise-level view of all institutes' financial summary"
      />

      <Card>
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div className="w-full sm:w-44">
            <Input
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-44">
            <Input
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <Button onClick={fetchReport} disabled={loading}>
            {loading ? 'Loading...' : 'Generate'}
          </Button>
        </div>

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : !reportData ? (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            Select a date range and click "Generate" to view the consolidated report
          </div>
        ) : (
          <>
            {/* Grand Totals */}
            {grandTotals && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <StatCard
                  title="Total Income"
                  value={<>₹{grandTotals.totalIncome.toLocaleString()}</>}
                  tone="success"
                />
                <StatCard
                  title="Total Expense"
                  value={<>₹{grandTotals.totalExpense.toLocaleString()}</>}
                  tone="destructive"
                />
                <StatCard
                  title="Net Balance"
                  value={<>₹{grandTotals.netBalance.toLocaleString()}</>}
                  tone="info"
                />
                <StatCard
                  title="Bank Balance"
                  value={<>₹{grandTotals.bankBalance.toLocaleString()}</>}
                  tone="info"
                />
              </div>
            )}

            {institutes.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No data found for this period</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-3 text-left text-label font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Institute
                      </th>
                      <th className="px-4 py-3 text-right text-label font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Income
                      </th>
                      <th className="px-4 py-3 text-right text-label font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Expense
                      </th>
                      <th className="px-4 py-3 text-right text-label font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Net Balance
                      </th>
                      <th className="px-4 py-3 text-right text-label font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Bank Balance
                      </th>
                      <th className="px-4 py-3 text-center text-label font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Transactions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-border">
                    {institutes.map((inst) => (
                      <tr key={inst.instituteId} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100 capitalize">
                          {inst.instituteName}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">
                          ₹{inst.totalIncome.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-red-600 dark:text-red-400">
                          ₹{inst.totalExpense.toLocaleString()}
                        </td>
                        <td
                          className={`px-4 py-3 text-sm text-right font-medium ${inst.netBalance >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}
                        >
                          ₹{inst.netBalance.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-purple-600 dark:text-purple-400">
                          ₹{inst.bankBalance.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-gray-600 dark:text-gray-400">
                          {inst.transactionCount}
                        </td>
                      </tr>
                    ))}
                    {/* Grand Total Row */}
                    {grandTotals && (
                      <tr className="bg-gray-100 dark:bg-gray-800 font-semibold">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">Grand Total</td>
                        <td className="px-4 py-3 text-sm text-right text-green-700 dark:text-green-300">
                          ₹{grandTotals.totalIncome.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-red-700 dark:text-red-300">
                          ₹{grandTotals.totalExpense.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-blue-700 dark:text-blue-300">
                          ₹{grandTotals.netBalance.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-purple-700 dark:text-purple-300">
                          ₹{grandTotals.bankBalance.toLocaleString()}
                        </td>
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
