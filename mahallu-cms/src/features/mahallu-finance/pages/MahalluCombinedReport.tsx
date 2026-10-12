import { useState, useEffect } from 'react';
import { FiTrendingUp, FiTrendingDown, FiDollarSign } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Alert from '@/components/ui/Alert';
import StatCard from '@/components/ui/StatCard';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import DateRangePicker from '@/components/ui/DateRangePicker';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { accountingReportService, DayBookEntry, TrialBalanceEntry } from '@/services/accountingReportService';
import { instituteService } from '@/services/instituteService';
import { pct } from '@/utils/statSeries';
import { getFriendlyError } from '@/utils/apiMessages';
import ScrollX from '@/features/_shared/ScrollX';

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
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => {
    instituteService.getAll({ limit: 1000 })
      .then(r => setInstitutes(r.data.map((i: any) => ({ id: i.id, name: i.name }))))
      .catch(() => {});
  }, []);

  const toggleEntity = (id: string) => {
    setSelectedEntities(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
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
      setError(getFriendlyError(err, "Couldn't generate combined report. Try again in a moment."));
    } finally {
      setLoading(false);
    }
  };

  const selectedNames = [
    ...(selectedEntities.includes('mahallu') ? ['Mahallu (Main)'] : []),
    ...institutes.filter(i => selectedEntities.includes(i.id)).map(i => i.name),
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Combined Report" description="Merge Mahallu and Institute financials into a single view" />

      {/* Filters */}
      <Card padding="lg">
        <h2 className="mb-3.5 text-sm font-bold text-primary-700 dark:text-surface-text">Report Configuration</h2>

        <div className="mb-5 flex flex-wrap items-end gap-3">
          <div className="w-52">
            <Select
              label="Report Type"
              options={[
                { value: 'day-book', label: 'Day Book' },
                { value: 'trial-balance', label: 'Trial Balance' },
                { value: 'balance-sheet', label: 'Balance Sheet' },
                { value: 'income-expenditure', label: 'Income & Expenditure' },
              ]}
              value={reportType}
              onChange={e => setReportType(e.target.value as ReportType)}
            />
          </div>
          <div className="w-72 max-sm:w-full">
            <DateRangePicker label="Date range" from={startDate} to={endDate} onChange={(f, t) => { setStartDate(f); setEndDate(t); }} />
          </div>
        </div>

        {/* Entity Selection */}
        <div className="mb-6">
          <p className="mb-2.5 text-xs font-semibold text-[#3A4741] dark:text-surface-text/80">Select Entities to Combine</p>
          <div className="flex flex-wrap gap-2">
            {/* Mahallu chip */}
            <button
              type="button"
              aria-pressed={selectedEntities.includes('mahallu')}
              onClick={() => toggleEntity('mahallu')}
              className={`px-3 py-1.5 max-sm:min-h-10 rounded-full text-xs font-semibold transition-colors border focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] ${
                selectedEntities.includes('mahallu')
                  ? 'bg-primary-700 text-white border-primary-700 dark:bg-brand-lime dark:text-primary-950 dark:border-brand-lime'
                  : 'bg-white text-[#3A4741] border-line-strong hover:border-primary-600 hover:bg-mint dark:bg-surface-raised dark:text-surface-text dark:border-surface-border-strong dark:hover:border-brand-lime'
              }`}
            >
              🏛️ Mahallu (Main)
            </button>
            {/* Institute chips */}
            {institutes.map(inst => (
              <button
                key={inst.id}
                type="button"
                aria-pressed={selectedEntities.includes(inst.id)}
                onClick={() => toggleEntity(inst.id)}
                className={`px-3 py-1.5 max-sm:min-h-10 rounded-full text-xs font-semibold transition-colors border focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] ${
                  selectedEntities.includes(inst.id)
                    ? 'bg-primary-700 text-white border-primary-700 dark:bg-brand-lime dark:text-primary-950 dark:border-brand-lime'
                    : 'bg-white text-[#3A4741] border-line-strong hover:border-primary-600 hover:bg-mint dark:bg-surface-raised dark:text-surface-text dark:border-surface-border-strong dark:hover:border-brand-lime'
                }`}
              >
                🏫 {inst.name}
              </button>
            ))}
          </div>
          {selectedEntities.length > 0 && (
            <p className="mt-2 text-xs text-[#7B8983] dark:text-surface-muted">
              Combining: <span className="font-semibold text-[#3A4741] dark:text-surface-text">{selectedNames.join(' + ')}</span>
            </p>
          )}
        </div>

        <Button onClick={fetchReport} disabled={loading || selectedEntities.length === 0}>
          {loading ? 'Generating...' : 'Generate Combined Report'}
        </Button>
      </Card>

      {/* Results */}
      {loading && <div className="flex justify-center py-12"><LoadingSpinner /></div>}

      {error && <Alert tone="danger">{error}</Alert>}

      {!loading && !error && reportData && (
        <Card padding="lg">
          <div className="mb-4 flex items-center gap-2">
            <h2 className="text-sm font-bold text-primary-700 dark:text-surface-text">
              {reportType === 'day-book' ? 'Day Book' : reportType === 'trial-balance' ? 'Trial Balance' : reportType === 'balance-sheet' ? 'Balance Sheet' : 'Income & Expenditure'}
            </h2>
            <span className="text-xs text-[#7B8983] dark:text-surface-muted">— {selectedNames.join(' + ')}</span>
          </div>

          {reportType === 'day-book' && Array.isArray(reportData) && (
            <DayBookView entries={reportData} />
          )}

          {reportType === 'trial-balance' && Array.isArray(reportData) && (
            <TrialBalanceView entries={reportData} />
          )}

          {reportType === 'balance-sheet' && reportData && (
            <BalanceSheetView data={reportData} />
          )}

          {reportType === 'income-expenditure' && reportData && (
            <IncomeExpenditureView data={reportData} />
          )}
        </Card>
      )}
    </div>
  );
}

function DayBookView({ entries }: { entries: DayBookEntry[] }) {
  const totalIncome = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
  const totalExpense = entries.filter(e => e.type !== 'income').reduce((s, e) => s + e.amount, 0);
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4">
        <StatCard variant="inline" title="Total Income" value={`₹${totalIncome.toLocaleString()}`} tone="green" icon={<FiTrendingUp className="h-[17px] w-[17px]" />} />
        <StatCard variant="inline" viz={totalIncome > 0 ? { type: 'bullet', percent: pct(totalExpense, totalIncome), target: 100, color: totalExpense > totalIncome ? '#B3261E' : '#04563A' } : undefined} summary={`Expense ₹${(totalExpense).toLocaleString()}, ${pct(totalExpense, totalIncome)} percent of income`} title="Total Expense" value={`₹${totalExpense.toLocaleString()}`} tone="red" icon={<FiTrendingDown className="h-[17px] w-[17px]" />} />
        <StatCard variant="inline" viz={totalIncome + totalExpense > 0 ? { type: 'pair', a: totalIncome, b: totalExpense, colorB: '#E0B400' } : undefined} summary={`Income ₹${(totalIncome).toLocaleString()} compared with expense ₹${(totalExpense).toLocaleString()}`} title="Net Balance" value={`₹${(totalIncome - totalExpense).toLocaleString()}`} tone="neutral" icon={<FiDollarSign className="h-[17px] w-[17px]" />} />
      </div>
      <ScrollX>
        <table className="w-full border-collapse text-[12.5px]">
          <thead className="bg-[#FAFCFB] dark:bg-surface-base/60">
            <tr>{['Date', 'Description', 'Type', 'Ledger', 'Category', 'Amount'].map(h => <th key={h} className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line-soft dark:divide-surface-border">
            {entries.map((entry, i) => (
              <tr key={i} className="hover:bg-[#F6FAF8] dark:hover:bg-surface-hover/60">
                <td className="px-3.5 py-2 text-[12.5px] whitespace-nowrap">{new Date(entry.date).toLocaleDateString()}</td>
                <td className="px-3.5 py-2 text-[12.5px]">{entry.description}</td>
                <td className="px-3.5 py-2"><Badge variant={entry.type === 'income' ? 'success' : 'danger'} dot className="capitalize">{entry.type}</Badge></td>
                <td className="px-3.5 py-2 text-[12.5px] text-[#5B6963] dark:text-surface-muted">{entry.ledgerName}</td>
                <td className="px-3.5 py-2 text-[12.5px] text-[#5B6963] dark:text-surface-muted">{entry.categoryName}</td>
                <td className={`px-3.5 py-2 text-[12.5px] font-medium ${entry.type === 'income' ? 'text-primary-600' : 'text-red-600'}`}>₹{entry.amount.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollX>
    </>
  );
}

function TrialBalanceView({ entries }: { entries: TrialBalanceEntry[] }) {
  const totalDebit = entries.reduce((s, e) => s + e.debit, 0);
  const totalCredit = entries.reduce((s, e) => s + e.credit, 0);
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-4">
        <StatCard variant="inline" title="Total Debit" value={`₹${totalDebit.toLocaleString()}`} tone="red" icon={<FiTrendingDown className="h-[17px] w-[17px]" />} />
        <StatCard variant="inline" title="Total Credit" value={`₹${totalCredit.toLocaleString()}`} tone="green" icon={<FiTrendingUp className="h-[17px] w-[17px]" />} />
        <StatCard variant="inline" viz={totalDebit + totalCredit > 0 ? { type: 'pair', a: totalCredit, b: totalDebit, colorB: '#E0B400' } : undefined} summary={`Credit ₹${totalCredit.toLocaleString()} compared with debit ₹${totalDebit.toLocaleString()}`} title="Difference" value={`₹${Math.abs(totalCredit - totalDebit).toLocaleString()}`} tone="neutral" icon={<FiDollarSign className="h-[17px] w-[17px]" />} />
      </div>
      <ScrollX>
        <table className="w-full border-collapse text-[12.5px]">
          <thead className="bg-[#FAFCFB] dark:bg-surface-base/60">
            <tr>{['Ledger', 'Type', 'Debit', 'Credit'].map(h => <th key={h} className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-line-soft dark:divide-surface-border">
            {entries.map((entry, i) => (
              <tr key={i} className="hover:bg-[#F6FAF8] dark:hover:bg-surface-hover/60">
                <td className="px-3.5 py-2 text-[12.5px] font-medium">{entry.ledgerName}</td>
                <td className="px-3.5 py-2"><Badge variant={entry.type === 'income' ? 'success' : 'danger'} dot className="capitalize">{entry.type}</Badge></td>
                <td className="px-3.5 py-2 text-[12.5px] text-red-600">{entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : '-'}</td>
                <td className="px-3.5 py-2 text-[12.5px] text-primary-600">{entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollX>
    </>
  );
}

function BalanceSheetView({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatCard variant="inline" title="Bank Balance" value={`₹${(data.totalBankBalance || 0).toLocaleString()}`} tone="neutral" icon={<FiDollarSign className="h-[17px] w-[17px]" />} />
        <StatCard variant="inline" title="Total Income" value={`₹${(data.totalIncome || 0).toLocaleString()}`} tone="green" icon={<FiTrendingUp className="h-[17px] w-[17px]" />} />
        <StatCard variant="inline" viz={(data.totalIncome || 0) > 0 ? { type: 'bullet', percent: pct((data.totalExpense || 0), (data.totalIncome || 0)), target: 100, color: (data.totalExpense || 0) > (data.totalIncome || 0) ? '#B3261E' : '#04563A' } : undefined} summary={`Expense ₹${((data.totalExpense || 0)).toLocaleString()}, ${pct((data.totalExpense || 0), (data.totalIncome || 0))} percent of income`} title="Total Expense" value={`₹${(data.totalExpense || 0).toLocaleString()}`} tone="red" icon={<FiTrendingDown className="h-[17px] w-[17px]" />} />
        <StatCard variant="inline" viz={(data.totalIncome || 0) + (data.totalExpense || 0) > 0 ? { type: 'pair', a: (data.totalIncome || 0), b: (data.totalExpense || 0), colorB: '#E0B400' } : undefined} summary={`Income ₹${((data.totalIncome || 0)).toLocaleString()} compared with expense ₹${((data.totalExpense || 0)).toLocaleString()}`} title="Net Balance" value={`₹${(data.netBalance || 0).toLocaleString()}`} tone="neutral" icon={<FiDollarSign className="h-[17px] w-[17px]" />} />
      </div>
      {(data.bankBalances || []).length > 0 && (
        <div>
          <h3 className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted mb-2">Bank Accounts</h3>
          {(data.bankBalances || []).map((b: any, i: number) => (
            <div key={i} className="flex justify-between px-4 py-2 border-b border-line-soft dark:border-surface-border"><span className="text-sm text-[#3A4741] dark:text-surface-text">{b.ledgerName}</span><span className="text-sm font-medium text-blue-700">₹{b.balance.toLocaleString()}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

function IncomeExpenditureView({ data }: { data: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard variant="inline" title="Total Income" value={`₹${(data.totalIncome || 0).toLocaleString()}`} tone="green" icon={<FiTrendingUp className="h-[17px] w-[17px]" />} />
        <StatCard variant="inline" viz={(data.totalIncome || 0) > 0 ? { type: 'bullet', percent: pct((data.totalExpense || 0), (data.totalIncome || 0)), target: 100, color: (data.totalExpense || 0) > (data.totalIncome || 0) ? '#B3261E' : '#04563A' } : undefined} summary={`Expense ₹${((data.totalExpense || 0)).toLocaleString()}, ${pct((data.totalExpense || 0), (data.totalIncome || 0))} percent of income`} title="Total Expense" value={`₹${(data.totalExpense || 0).toLocaleString()}`} tone="red" icon={<FiTrendingDown className="h-[17px] w-[17px]" />} />
        <StatCard variant="inline" viz={(data.totalIncome || 0) + (data.totalExpense || 0) > 0 ? { type: 'pair', a: (data.totalIncome || 0), b: (data.totalExpense || 0), colorB: '#E0B400' } : undefined} summary={`Income ₹${((data.totalIncome || 0)).toLocaleString()} compared with expense ₹${((data.totalExpense || 0)).toLocaleString()}`} title={(data.surplus || 0) >= 0 ? 'Surplus' : 'Deficit'} value={`₹${Math.abs(data.surplus || 0).toLocaleString()}`} tone={(data.surplus || 0) >= 0 ? 'green' : 'red'} icon={<FiDollarSign className="h-[17px] w-[17px]" />} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-primary-700 uppercase mb-2">Income</h3>
          {(data.income || []).map((ledger: any, i: number) => (
            <div key={i} className="border border-primary-200 dark:border-primary-800 rounded-lg mb-2 overflow-hidden">
              <div className="flex justify-between px-4 py-2 bg-primary-50 dark:bg-primary-900/20"><span className="text-sm font-semibold text-primary-800">{ledger.ledgerName}</span><span className="text-sm font-bold text-primary-700">₹{(ledger.ledgerTotal || ledger.total || 0).toLocaleString()}</span></div>
              {(ledger.categories || []).map((cat: any, j: number) => (
                <div key={j} className="flex justify-between px-4 py-1.5 border-t border-primary-100"><span className="text-xs text-[#5B6963] dark:text-surface-muted pl-4">{cat.categoryName}</span><span className="text-xs text-[#3A4741] dark:text-surface-text">₹{(cat.total || 0).toLocaleString()}</span></div>
              ))}
            </div>
          ))}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-red-700 uppercase mb-2">Expenses</h3>
          {(data.expenses || []).map((ledger: any, i: number) => (
            <div key={i} className="border border-red-200 dark:border-red-800 rounded-lg mb-2 overflow-hidden">
              <div className="flex justify-between px-4 py-2 bg-red-50 dark:bg-red-900/20"><span className="text-sm font-semibold text-red-800">{ledger.ledgerName}</span><span className="text-sm font-bold text-red-700">₹{(ledger.ledgerTotal || ledger.total || 0).toLocaleString()}</span></div>
              {(ledger.categories || []).map((cat: any, j: number) => (
                <div key={j} className="flex justify-between px-4 py-1.5 border-t border-red-100"><span className="text-xs text-[#5B6963] dark:text-surface-muted pl-4">{cat.categoryName}</span><span className="text-xs text-[#3A4741] dark:text-surface-text">₹{(cat.total || 0).toLocaleString()}</span></div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
