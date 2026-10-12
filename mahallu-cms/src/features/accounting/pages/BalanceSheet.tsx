import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Alert from '@/components/ui/Alert';
import FilterBar from '@/components/ui/FilterBar';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import DateRangePicker from '@/components/ui/DateRangePicker';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { accountingReportService, BalanceSheetData } from '@/services/accountingReportService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import { getFriendlyError } from '@/utils/apiMessages';

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
    } catch (err) { console.error('Error:', err); }
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
      setError(getFriendlyError(err, "Couldn't load balance sheet. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Balance Sheet" description="Financial position overview" />

      <Card padding="none" className="overflow-visible">
        <FilterBar className="items-end">
          <div className="w-72 max-sm:w-full">
            <DateRangePicker label="Date range" from={startDate} to={endDate} onChange={(f, t) => { setStartDate(f); setEndDate(t); }} />
          </div>
          {!userInstituteId && (
            <div className="w-48">
              <Select
                label="Institute"
                options={[{ value: 'all', label: 'All Institutes' }, ...institutes.map(i => ({ value: i.id, label: i.name }))]}
                value={instituteFilter}
                onChange={(e) => setInstituteFilter(e.target.value)}
              />
            </div>
          )}
          <Button onClick={fetchBalanceSheet} disabled={loading}>
            {loading ? 'Loading...' : 'Generate'}
          </Button>
        </FilterBar>

        <div className="p-3.5">
          {loading ? (
            <div className="flex justify-center items-center py-12"><LoadingSpinner /></div>
          ) : error ? (
            <Alert tone="danger">{error}</Alert>
          ) : !data ? (
            <EmptyState title="Nothing to show yet" description='Select a date range and click "Generate" to view the balance sheet' />
          ) : (
            <div className="space-y-8">
              {/* Net Balance Summary */}
              <div className={`p-6 rounded-lg ${data.netBalance >= 0 ? 'bg-primary-50 dark:bg-primary-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
                <p className={`text-sm ${data.netBalance >= 0 ? 'text-primary-600 dark:text-primary-400' : 'text-[#B3261E] dark:text-red-300'}`}>Net Balance</p>
                <p className={`text-3xl font-bold ${data.netBalance >= 0 ? 'text-primary-700 dark:text-primary-300' : 'text-red-700 dark:text-red-300'}`}>
                  ₹{data.netBalance.toLocaleString()}
                </p>
                <p className="text-sm text-[#7B8983] dark:text-surface-muted mt-1">
                  Income (₹{data.totalIncome.toLocaleString()}) - Expenses (₹{data.totalExpenseWithSalary.toLocaleString()})
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Bank Balances */}
                {data.bankBalances && data.bankBalances.length > 0 && (
                  <div>
                    <h3 className="text-sm font-bold text-[#18231E] dark:text-surface-text mb-3">Bank Balances</h3>
                    <div className="space-y-2">
                      {data.bankBalances.map((bank, idx) => (
                        <div key={idx} className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <span className="text-sm text-[#3A4741] dark:text-surface-text">{bank.ledgerName}</span>
                          <span className="font-semibold text-blue-700 dark:text-blue-300">₹{bank.balance.toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center p-3 bg-blue-100 dark:bg-blue-900/40 rounded-lg font-bold">
                        <span className="text-[#18231E] dark:text-surface-text">Total Bank Balance</span>
                        <span className="text-blue-900 dark:text-blue-200">₹{data.totalBankBalance.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Income by Category */}
                <div>
                  <h3 className="text-sm font-bold text-primary-700 dark:text-primary-300 mb-3">Income</h3>
                  <div className="space-y-2">
                    {data.incomeByCategory && data.incomeByCategory.map((cat, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                        <span className="text-sm text-[#3A4741] dark:text-surface-text">{cat.category}</span>
                        <span className="font-medium text-primary-700 dark:text-primary-300">₹{cat.amount.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between items-center p-3 bg-primary-100 dark:bg-primary-900/40 rounded-lg font-bold">
                      <span className="text-[#18231E] dark:text-surface-text">Total Income</span>
                      <span className="text-primary-900 dark:text-primary-200">₹{data.totalIncome.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                {/* Expenses by Category */}
                <div>
                  <h3 className="text-sm font-bold text-red-700 dark:text-red-300 mb-3">Expenses</h3>
                  <div className="space-y-2">
                    {data.expenseByCategory && data.expenseByCategory.map((cat, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                        <span className="text-sm text-[#3A4741] dark:text-surface-text">{cat.category}</span>
                        <span className="font-medium text-red-700 dark:text-red-300">₹{cat.amount.toLocaleString()}</span>
                      </div>
                    ))}
                    {data.salaryExpense > 0 && (
                      <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                        <span className="text-sm text-[#3A4741] dark:text-surface-text">Salary Payments</span>
                        <span className="font-medium text-purple-700 dark:text-purple-300">₹{data.salaryExpense.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center p-3 bg-red-100 dark:bg-red-900/40 rounded-lg font-bold">
                      <span className="text-[#18231E] dark:text-surface-text">Total Expenses</span>
                      <span className="text-red-900 dark:text-red-200">₹{data.totalExpenseWithSalary.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </Card>
    </div>
  );
}
