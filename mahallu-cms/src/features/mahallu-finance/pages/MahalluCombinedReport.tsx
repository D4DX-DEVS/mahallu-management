import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { accountingReportService, DayBookEntry, TrialBalanceEntry } from '@/services/accountingReportService';
import { instituteService } from '@/services/instituteService';
import { FiHome, FiBook } from 'react-icons/fi';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

type ReportType = 'day-book' | 'trial-balance' | 'balance-sheet' | 'income-expenditure';

interface Institute {
  id: string;
  name: string;
}

export default function MahalluCombinedReport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [selectedEntities, setSelectedEntities] = useState<string[]>(['mahallu']);
  const [reportType, setReportType] = useState<ReportType>('day-book');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => {
    instituteService
      .getAll({ limit: 1000 })
      .then((r) => setInstitutes(r.data.map((i: any) => ({ id: i.id, name: i.name }))))
      .catch(() => {});
  }, []);

  const toggleEntity = (id: string) => {
    setSelectedEntities((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  };

  const buildIncludeEntities = () => selectedEntities.join(',');

  const fetchReport = async () => {
    if (selectedEntities.length === 0) {
      setError('Please select at least one entity');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      setReportData(null);
      const includeEntities = buildIncludeEntities();
      const params = { startDate, endDate, scope: 'combined', includeEntities };

      let result: any;
      switch (reportType) {
        case 'day-book':
          result = await accountingReportService.getDayBook(params);
          break;
        case 'trial-balance':
          result = await accountingReportService.getTrialBalance(params);
          break;
        case 'balance-sheet':
          result = await accountingReportService.getBalanceSheet(params);
          break;
        case 'income-expenditure':
          result = await accountingReportService.getIncomeExpenditure(params);
          break;
      }
      setReportData(result);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'generate combined report' }));
    } finally {
      setLoading(false);
    }
  };

  const selectedNames = [
    ...(selectedEntities.includes('mahallu') ? ['Mahallu (Main)'] : []),
    ...institutes.filter((i) => selectedEntities.includes(i.id)).map((i) => i.name),
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Combined Report"
        description="Merge Mahallu and Institute financials into a single view"
        breadcrumbs={[{ label: 'Mahallu Finance', path: '/mahallu-finance/accounts' }]}
      />

      {/* Filters */}
      <Card>
        <h2 className="text-base font-semibold mb-3 text-foreground">
          Report Configuration
        </h2>

        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div className="w-full sm:w-52">
            <Select
              label="Report Type"
              options={[
                { value: 'day-book', label: 'Day Book' },
                { value: 'trial-balance', label: 'Trial Balance' },
                { value: 'balance-sheet', label: 'Balance Sheet' },
                { value: 'income-expenditure', label: 'Income & Expenditure' },
              ]}
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
            />
          </div>
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
        </div>

        {/* Entity Selection */}
        <div className="mb-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            Select Entities to Combine
          </p>
          <div className="flex flex-wrap gap-2">
            {/* Mahallu chip */}
            <button
              onClick={() => toggleEntity('mahallu')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                selectedEntities.includes('mahallu')
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-indigo-400'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <FiHome className="h-3.5 w-3.5" /> Mahallu (Main)
              </span>
            </button>
            {/* Institute chips */}
            {institutes.map((inst) => (
              <button
                key={inst.id}
                onClick={() => toggleEntity(inst.id)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                  selectedEntities.includes(inst.id)
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                }`}
              >
                <span className="inline-flex items-center gap-1.5 capitalize">
                  <FiBook className="h-3.5 w-3.5" /> {inst.name}
                </span>
              </button>
            ))}
          </div>
          {selectedEntities.length > 0 && (
            <p className="mt-2 text-xs text-gray-500">
              Combining:
              <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">
                {selectedNames.join(' + ')}
              </span>
            </p>
          )}
        </div>

        <Button onClick={fetchReport} disabled={loading || selectedEntities.length === 0}>
          {loading ? 'Generating...' : 'Generate Combined Report'}
        </Button>
      </Card>

      {/* Results */}
      {loading && <PageSkeleton variant="section" />}

      {error && (
        <Card>
          <p className="text-center py-8 text-red-600">{error}</p>
        </Card>
      )}

      {!loading && !error && reportData && (
        <Card>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-base font-semibold text-foreground">
              {reportType === 'day-book'
                ? 'Day Book'
                : reportType === 'trial-balance'
                  ? 'Trial Balance'
                  : reportType === 'balance-sheet'
                    ? 'Balance Sheet'
                    : 'Income & Expenditure'}
            </h2>
            <span className="text-xs text-gray-500 capitalize">— {selectedNames.join(' + ')}</span>
          </div>

          {reportType === 'day-book' && Array.isArray(reportData) && <DayBookView entries={reportData} />}

          {reportType === 'trial-balance' && Array.isArray(reportData) && (
            <TrialBalanceView entries={reportData} />
          )}

          {reportType === 'balance-sheet' && reportData && <BalanceSheetView data={reportData} />}

          {reportType === 'income-expenditure' && reportData && <IncomeExpenditureView data={reportData} />}
        </Card>
      )}
    </div>
  );
}

function DayBookView({ entries }: { entries: DayBookEntry[] }) {
  const totalIncome = entries.filter((e) => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const totalExpense = entries.filter((e) => e.type !== 'income').reduce((s, e) => s + e.amount, 0);
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <StatCard title="Total Income" value={<>₹{totalIncome.toLocaleString()}</>} tone="success" />
        <StatCard title="Total Expense" value={<>₹{totalExpense.toLocaleString()}</>} tone="destructive" />
        <StatCard
          title="Net Balance"
          value={<>₹{(totalIncome - totalExpense).toLocaleString()}</>}
          tone="info"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              {['Date', 'Description', 'Type', 'Ledger', 'Category', 'Amount'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-label font-medium text-gray-500 uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((entry, i) => (
              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 text-sm whitespace-nowrap">
                  {new Date(entry.date).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-sm">{entry.description}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${entry.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                  >
                    {entry.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600 capitalize">{entry.ledgerName}</td>
                <td className="px-4 py-3 text-sm text-gray-600 capitalize">{entry.categoryName}</td>
                <td
                  className={`px-4 py-3 text-sm font-medium ${entry.type === 'income' ? 'text-green-600' : 'text-red-600'}`}
                >
                  ₹{entry.amount.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TrialBalanceView({ entries }: { entries: TrialBalanceEntry[] }) {
  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <StatCard title="Total Debit" value={<>₹{totalDebit.toLocaleString()}</>} tone="destructive" />
        <StatCard title="Total Credit" value={<>₹{totalCredit.toLocaleString()}</>} tone="success" />
        <StatCard title="Difference" value={<>₹{Math.abs(totalCredit - totalDebit).toLocaleString()}</>} />
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border">
          <thead className="bg-muted">
            <tr>
              {['Ledger', 'Type', 'Debit', 'Credit'].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-label font-medium text-gray-500 uppercase">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {entries.map((entry, i) => (
              <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                <td className="px-4 py-3 text-sm font-medium capitalize">{entry.ledgerName}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${entry.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                  >
                    {entry.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-red-600">
                  {entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : '-'}
                </td>
                <td className="px-4 py-3 text-sm text-green-600">
                  {entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function BalanceSheetView({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          title="Bank Balance"
          value={<>₹{(data.totalBankBalance || 0).toLocaleString()}</>}
          tone="info"
        />
        <StatCard
          title="Total Income"
          value={<>₹{(data.totalIncome || 0).toLocaleString()}</>}
          tone="success"
        />
        <StatCard
          title="Total Expense"
          value={<>₹{(data.totalExpense || 0).toLocaleString()}</>}
          tone="destructive"
        />
        <StatCard title="Net Balance" value={<>₹{(data.netBalance || 0).toLocaleString()}</>} />
      </div>
      {(data.bankBalances || []).length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2 text-foreground">Bank Accounts</h3>
          {(data.bankBalances || []).map((b: any, i: number) => (
            <div
              key={i}
              className="flex justify-between px-4 py-2 border-b border-gray-100 dark:border-gray-700"
            >
              <span className="text-sm text-gray-700 capitalize">{b.ledgerName}</span>
              <span className="text-sm font-medium text-blue-700">₹{b.balance.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function IncomeExpenditureView({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          title="Total Income"
          value={<>₹{(data.totalIncome || 0).toLocaleString()}</>}
          tone="success"
        />
        <StatCard
          title="Total Expense"
          value={<>₹{(data.totalExpense || 0).toLocaleString()}</>}
          tone="destructive"
        />
        <div className={`p-4 rounded-lg ${(data.surplus || 0) >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
          <p className="text-sm text-gray-600">{(data.surplus || 0) >= 0 ? 'Surplus' : 'Deficit'}</p>
          <p className="text-2xl font-semibold tabular-nums text-gray-700">₹{Math.abs(data.surplus || 0).toLocaleString()}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-green-700 mb-2">Income</h3>
          {(data.income || []).map((ledger: any, i: number) => (
            <div
              key={i}
              className="border border-green-200 dark:border-green-800 rounded-lg mb-2 overflow-hidden"
            >
              <div className="flex justify-between px-4 py-2 bg-green-50 dark:bg-green-900/20">
                <span className="text-sm font-semibold text-green-800 capitalize">{ledger.ledgerName}</span>
                <span className="text-sm font-semibold text-green-700">
                  ₹{(ledger.ledgerTotal || ledger.total || 0).toLocaleString()}
                </span>
              </div>
              {(ledger.categories || []).map((cat: any, j: number) => (
                <div key={j} className="flex justify-between px-4 py-1.5 border-t border-green-100">
                  <span className="text-xs text-gray-600 pl-4 capitalize">{cat.categoryName}</span>
                  <span className="text-xs text-gray-700">₹{(cat.total || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-red-700 mb-2">Expenses</h3>
          {(data.expenses || []).map((ledger: any, i: number) => (
            <div
              key={i}
              className="border border-red-200 dark:border-red-800 rounded-lg mb-2 overflow-hidden"
            >
              <div className="flex justify-between px-4 py-2 bg-red-50 dark:bg-red-900/20">
                <span className="text-sm font-semibold text-red-800 capitalize">{ledger.ledgerName}</span>
                <span className="text-sm font-semibold text-red-700">
                  ₹{(ledger.ledgerTotal || ledger.total || 0).toLocaleString()}
                </span>
              </div>
              {(ledger.categories || []).map((cat: any, j: number) => (
                <div key={j} className="flex justify-between px-4 py-1.5 border-t border-red-100">
                  <span className="text-xs text-gray-600 pl-4 capitalize">{cat.categoryName}</span>
                  <span className="text-xs text-gray-700">₹{(cat.total || 0).toLocaleString()}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
