import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { accountingReportService } from '@/services/accountingReportService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';

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
      setError(err.response?.data?.message || 'Failed to fetch report');
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
        <div key={group.ledgerId} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <div className={`px-4 py-2 ${colorClass} flex justify-between items-center`}>
            <span className="font-semibold text-sm">{group.ledgerName}</span>
            <span className="font-bold text-sm">₹{group.total.toLocaleString()}</span>
          </div>
          {group.categories.length > 0 && (
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {group.categories.map((cat, idx) => (
                <div key={idx} className="px-6 py-2 flex justify-between text-sm">
                  <span className="text-gray-700 dark:text-gray-300">{cat.categoryName}</span>
                  <span className="text-gray-900 dark:text-gray-100 font-medium">₹{cat.total.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Income & Expenditure</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Detailed breakdown of income and expenses by ledger and category</p>
        </div>
        <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Income & Expenditure' }]} />
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div className="w-44">
            <Input label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div className="w-44">
            <Input label="End Date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
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
        </div>

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-12"><p className="text-red-600 dark:text-red-400">{error}</p></div>
        ) : !reportData ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Select a date range and click "Generate" to view the report
          </div>
        ) : (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-green-600 dark:text-green-400">Total Income</p>
                <p className="text-xl font-bold text-green-700 dark:text-green-300">₹{totalIncome.toLocaleString()}</p>
              </div>
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">Total Expenditure</p>
                <p className="text-xl font-bold text-red-700 dark:text-red-300">₹{totalExpense.toLocaleString()}</p>
              </div>
              <div className={`p-4 rounded-lg ${surplus >= 0 ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-orange-50 dark:bg-orange-900/20'}`}>
                <p className={`text-sm ${surplus >= 0 ? 'text-blue-600 dark:text-blue-400' : 'text-orange-600 dark:text-orange-400'}`}>
                  {surplus >= 0 ? 'Surplus' : 'Deficit'}
                </p>
                <p className={`text-xl font-bold ${surplus >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700 dark:text-orange-300'}`}>
                  ₹{Math.abs(surplus).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Income Section */}
              <div>
                <h3 className="text-lg font-semibold text-green-700 dark:text-green-400 mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-green-500"></span>
                  Income
                </h3>
                {incomeGroups.length > 0
                  ? renderLedgerGroup(incomeGroups, 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200')
                  : <p className="text-gray-500 text-sm">No income records</p>
                }
                <div className="mt-3 px-4 py-2 bg-green-100 dark:bg-green-900/30 rounded-lg flex justify-between">
                  <span className="font-semibold text-green-800 dark:text-green-200">Total Income</span>
                  <span className="font-bold text-green-800 dark:text-green-200">₹{totalIncome.toLocaleString()}</span>
                </div>
              </div>

              {/* Expense Section */}
              <div>
                <h3 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-3 flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-500"></span>
                  Expenditure
                </h3>
                {expenseGroups.length > 0
                  ? renderLedgerGroup(expenseGroups, 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200')
                  : <p className="text-gray-500 text-sm">No expense records</p>
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
                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Net {surplus >= 0 ? 'Surplus' : 'Deficit'}
                </span>
                <span className={`text-2xl font-bold ${surplus >= 0 ? 'text-blue-700 dark:text-blue-300' : 'text-orange-700 dark:text-orange-300'}`}>
                  ₹{Math.abs(surplus).toLocaleString()}
                </span>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
