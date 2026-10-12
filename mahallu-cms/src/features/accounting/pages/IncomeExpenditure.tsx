import { useState, useEffect } from 'react';
import { FiDollarSign, FiTrendingUp } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import Alert from '@/components/ui/Alert';
import FilterBar from '@/components/ui/FilterBar';
import StatCard from '@/components/ui/StatCard';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import DateRangePicker from '@/components/ui/DateRangePicker';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { accountingReportService } from '@/services/accountingReportService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import { pct } from '@/utils/statSeries';
import { getFriendlyError } from '@/utils/apiMessages';

interface CategoryItem {
  categoryId: string;
  categoryName: string;
  total: number;
  count: number;
}

interface LedgerGroup {
  ledgerId: string;
  ledgerName: string;
  categories: CategoryItem[];
  total: number;
}

export default function IncomeExpenditure() {
  const { currentInstituteId: userInstituteId } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [institutes, setInstitutes] = useState<{ id: string; name: string }[]>([]);
  const [instituteFilter, setInstituteFilter] = useState(userInstituteId || 'all');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 11); d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => {
    if (!userInstituteId) fetchInstitutes();
  }, []);

  const fetchInstitutes = async () => {
    try {
      const result = await instituteService.getAll({ limit: 1000 });
      setInstitutes(result.data.map((i: any) => ({ id: i.id, name: i.name })));
    } catch (err) { console.error('Error:', err); }
  };

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { startDate, endDate };
      if (instituteFilter !== 'all') params.instituteId = instituteFilter;
      const data = await accountingReportService.getIncomeExpenditure(params);
      setReportData(data);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load report. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  const incomeGroups: LedgerGroup[] = reportData?.income || [];
  const expenseGroups: LedgerGroup[] = reportData?.expenses || [];
  const totalIncome = reportData?.totalIncome || 0;
  const totalExpense = reportData?.totalExpense || 0;
  const surplus = reportData?.surplus || 0;

  const renderLedgerGroup = (groups: LedgerGroup[], colorClass: string) => (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.ledgerId} className="border border-line dark:border-surface-border rounded-lg overflow-hidden">
          <div className={`px-4 py-2 ${colorClass} flex justify-between items-center`}>
            <span className="font-semibold text-sm">{group.ledgerName}</span>
            <span className="font-bold text-sm">₹{group.total.toLocaleString()}</span>
          </div>
          {group.categories.length > 0 && (
            <div className="divide-y divide-line-soft dark:divide-surface-border">
              {group.categories.map((cat, idx) => (
                <div key={idx} className="px-6 py-2 flex justify-between text-sm">
                  <span className="text-[#3A4741] dark:text-surface-text">{cat.categoryName}</span>
                  <span className="text-[#18231E] dark:text-surface-text font-medium">₹{cat.total.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Income & Expenditure" description="Detailed breakdown of income and expenses by ledger and category" />

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
          <Button onClick={fetchReport} disabled={loading}>
            {loading ? 'Loading...' : 'Generate'}
          </Button>
        </FilterBar>

        <div className="p-3.5">
          {loading ? (
            <div className="flex justify-center items-center py-12"><LoadingSpinner /></div>
          ) : error ? (
            <Alert tone="danger">{error}</Alert>
          ) : !reportData ? (
            <EmptyState title="Nothing to show yet" description='Select a date range and click "Generate" to view the report' />
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4">
                <StatCard variant="inline" title="Total Income" value={`₹${totalIncome.toLocaleString()}`} tone="green" icon={<FiTrendingUp className="h-[17px] w-[17px]" />} />
                <StatCard variant="inline" viz={totalIncome > 0 ? { type: 'bullet', percent: pct(totalExpense, totalIncome), target: 100, color: totalExpense > totalIncome ? '#B3261E' : '#04563A' } : undefined} summary={`Expense ₹${(totalExpense).toLocaleString()}, ${pct(totalExpense, totalIncome)} percent of income`} title="Total Expenditure" value={`₹${totalExpense.toLocaleString()}`} tone="red" />
                <StatCard variant="inline" title={surplus >= 0 ? 'Surplus' : 'Deficit'} value={`₹${Math.abs(surplus).toLocaleString()}`} tone={surplus >= 0 ? 'lime' : 'red'} icon={<FiDollarSign className="h-[17px] w-[17px]" />} viz={totalIncome + totalExpense > 0 ? { type: 'pair', a: totalIncome, b: totalExpense, colorB: '#E0B400' } : undefined} summary={`Income ₹${(totalIncome).toLocaleString()} compared with expense ₹${(totalExpense).toLocaleString()}`} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Income Section */}
                <div>
                  <h3 className="text-sm font-bold text-primary-700 dark:text-primary-400 mb-3 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-primary-500"></span>
                    Income
                  </h3>
                  {incomeGroups.length > 0
                    ? renderLedgerGroup(incomeGroups, 'bg-primary-50 dark:bg-primary-900/20 text-primary-800 dark:text-primary-200')
                    : <p className="text-[#7B8983] dark:text-surface-muted text-sm">No income records</p>
                  }
                  <div className="mt-3 px-4 py-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex justify-between">
                    <span className="font-semibold text-primary-800 dark:text-primary-200">Total Income</span>
                    <span className="font-bold text-primary-800 dark:text-primary-200">₹{totalIncome.toLocaleString()}</span>
                  </div>
                </div>

                {/* Expense Section */}
                <div>
                  <h3 className="text-sm font-bold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500"></span>
                    Expenditure
                  </h3>
                  {expenseGroups.length > 0
                    ? renderLedgerGroup(expenseGroups, 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200')
                    : <p className="text-[#7B8983] dark:text-surface-muted text-sm">No expense records</p>
                  }
                  <div className="mt-3 px-4 py-2 bg-red-100 dark:bg-red-900/30 rounded-lg flex justify-between">
                    <span className="font-semibold text-red-800 dark:text-red-200">Total Expenditure</span>
                    <span className="font-bold text-red-800 dark:text-red-200">₹{totalExpense.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Final Surplus/Deficit */}
              <div className={`mt-6 p-4 rounded-lg border-2 ${surplus >= 0 ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20' : 'border-orange-300 bg-orange-50 dark:border-orange-700 dark:bg-orange-900/20'}`}>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold text-[#18231E] dark:text-surface-text">
                    Net {surplus >= 0 ? 'Surplus' : 'Deficit'}
                  </span>
                  <span className={`text-2xl font-bold ${surplus >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700 dark:text-orange-300'}`}>
                    ₹{Math.abs(surplus).toLocaleString()}
                  </span>
                </div>
              </div>
            </>
          )}

        </div>
      </Card>
    </div>
  );
}
