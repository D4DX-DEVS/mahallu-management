import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { accountingReportService, BalanceSheetData } from '@/services/accountingReportService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

export default function BalanceSheet() {
  const { currentInstituteId: userInstituteId } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [institutes, setInstitutes] = useState<{ id: string; name: string }[]>([]);
  const [instituteFilter, setInstituteFilter] = useState(userInstituteId || 'all');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(0, 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!userInstituteId) fetchInstitutes();
  }, []);

  const fetchInstitutes = async () => {
    try {
      const result = await instituteService.getAll({ limit: 1000 });
      setInstitutes(result.data.map((i: any) => ({ id: i.id, name: i.name })));
    } catch (err) {
      console.error('Error:', err);
    }
  };

  const fetchBalanceSheet = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { startDate, endDate };
      if (instituteFilter !== 'all') params.instituteId = instituteFilter;
      const result = await accountingReportService.getBalanceSheet(params);
      setData(result);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'balance sheet'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Balance Sheet" description="Financial position overview" />

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
          {!userInstituteId && (
            <div className="w-full sm:w-48">
              <Select
                label="Institute"
                options={[
                  { value: 'all', label: 'All Institutes' },
                  ...institutes.map((i) => ({ value: i.id, label: i.name })),
                ]}
                value={instituteFilter}
                onChange={(e) => setInstituteFilter(e.target.value)}
              />
            </div>
          )}
          <Button onClick={fetchBalanceSheet} disabled={loading}>
            {loading ? 'Loading...' : 'Generate'}
          </Button>
        </div>

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : !data ? (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            Select a date range and click "Generate" to view the balance sheet
          </div>
        ) : (
          <div className="space-y-4">
            {/* Net Balance Summary */}
            <div
              className={`p-4 rounded-lg ${data.netBalance >= 0 ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}
            >
              <p
                className={`text-sm ${data.netBalance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
              >
                Net Balance
              </p>
              <p
                className={`text-2xl font-semibold tabular-nums ${data.netBalance >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}
              >
                ₹{data.netBalance.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Income (₹{data.totalIncome.toLocaleString()}) - Expenses (₹
                {data.totalExpenseWithSalary.toLocaleString()})
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Bank Balances */}
              {data.bankBalances && data.bankBalances.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-3 text-foreground">
                    Bank Balances
                  </h3>
                  <div className="space-y-2">
                    {data.bankBalances.map((bank, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-300">{bank.ledgerName}</span>
                        <span className="font-semibold text-blue-700 dark:text-blue-300">
                          ₹{bank.balance.toLocaleString()}
                        </span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center p-3 bg-blue-100 dark:bg-blue-900/40 rounded-lg font-semibold">
                      <span className="text-gray-900 dark:text-gray-100">Total Bank Balance</span>
                      <span className="text-blue-900 dark:text-blue-200">
                        ₹{data.totalBankBalance.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Income by Category */}
              <div>
                <h3 className="text-lg font-semibold text-green-700 dark:text-green-300 mb-3">Income</h3>
                <div className="space-y-2">
                  {data.incomeByCategory &&
                    data.incomeByCategory.map((cat, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg"
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-300">{cat.category}</span>
                        <span className="font-medium text-green-700 dark:text-green-300">
                          ₹{cat.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  <div className="flex justify-between items-center p-3 bg-green-100 dark:bg-green-900/40 rounded-lg font-semibold">
                    <span className="text-gray-900 dark:text-gray-100">Total Income</span>
                    <span className="text-green-900 dark:text-green-200">
                      ₹{data.totalIncome.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Expenses by Category */}
              <div>
                <h3 className="text-lg font-semibold text-red-700 dark:text-red-300 mb-3">Expenses</h3>
                <div className="space-y-2">
                  {data.expenseByCategory &&
                    data.expenseByCategory.map((cat, idx) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg"
                      >
                        <span className="text-sm text-gray-700 dark:text-gray-300">{cat.category}</span>
                        <span className="font-medium text-red-700 dark:text-red-300">
                          ₹{cat.amount.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  {data.salaryExpense > 0 && (
                    <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                      <span className="text-sm text-gray-700 dark:text-gray-300">Salary Payments</span>
                      <span className="font-medium text-purple-700 dark:text-purple-300">
                        ₹{data.salaryExpense.toLocaleString()}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center p-3 bg-red-100 dark:bg-red-900/40 rounded-lg font-semibold">
                    <span className="text-gray-900 dark:text-gray-100">Total Expenses</span>
                    <span className="text-red-900 dark:text-red-200">
                      ₹{data.totalExpenseWithSalary.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
