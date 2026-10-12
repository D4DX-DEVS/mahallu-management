import { useState, useEffect } from 'react';
import { FiTrendingUp, FiTrendingDown, FiDollarSign } from 'react-icons/fi';
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
import { masterAccountService, Ledger } from '@/services/masterAccountService';
import { getFriendlyError } from '@/utils/apiMessages';
import ScrollX from '@/features/_shared/ScrollX';

export default function MahalluLedgerReport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [ledgerId, setLedgerId] = useState('');
  const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    masterAccountService.getAllLedgers({ limit: 1000, scope: 'mahallu' }).then(r => setLedgers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  const fetchData = async () => {
    if (!ledgerId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await accountingReportService.getLedgerReport({ ledgerId, startDate, endDate, scope: 'mahallu' });
      setReportData(result);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load ledger report. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Mahallu Ledger Report" description="Detailed transactions for a Mahallu ledger" />

      <Card padding="none" className="overflow-visible">
        <FilterBar className="items-end">
          <div className="w-56">
            <Select
              label="Ledger *"
              options={[{ value: '', label: 'Select Ledger...' }, ...ledgers.map(l => ({ value: l.id, label: `${l.name} (${l.type})` }))]}
              value={ledgerId}
              onChange={e => setLedgerId(e.target.value)}
            />
          </div>
          <div className="w-72 max-sm:w-full">
            <DateRangePicker label="Date range" from={startDate} to={endDate} onChange={(f, t) => { setStartDate(f); setEndDate(t); }} />
          </div>
          <Button onClick={fetchData} disabled={loading || !ledgerId}>{loading ? 'Loading...' : 'Generate'}</Button>
        </FilterBar>

        <div className="p-3.5">
          {loading ? (
            <div className="flex justify-center py-12"><LoadingSpinner /></div>
          ) : error ? (
            <Alert tone="danger">{error}</Alert>
          ) : !reportData ? (
            <EmptyState title="Nothing to show yet" description='Select a ledger and date range, then click "Generate"' />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 mb-4">
                <StatCard variant="inline" title="Opening Balance" value={`₹${(reportData.openingBalance || 0).toLocaleString()}`} tone="neutral" icon={<FiDollarSign className="h-[17px] w-[17px]" />} />
                <StatCard variant="inline" viz={(reportData.totalDebit || 0) + (reportData.totalCredit || 0) > 0 ? { type: 'segments', segments: [{ value: reportData.totalCredit || 0 }, { value: reportData.totalDebit || 0, color: '#E0B400' }] } : undefined} summary={`Debit ₹${(reportData.totalDebit || 0).toLocaleString()} against credit ₹${(reportData.totalCredit || 0).toLocaleString()}`} title="Total Debit" value={`₹${(reportData.totalDebit || 0).toLocaleString()}`} tone="red" icon={<FiTrendingDown className="h-[17px] w-[17px]" />} />
                <StatCard variant="inline" title="Total Credit" value={`₹${(reportData.totalCredit || 0).toLocaleString()}`} tone="green" icon={<FiTrendingUp className="h-[17px] w-[17px]" />} />
                <StatCard variant="inline" viz={Math.max(reportData.openingBalance || 0, reportData.closingBalance || 0) > 0 ? { type: 'pair', a: Math.max(reportData.openingBalance || 0, 0), b: Math.max(reportData.closingBalance || 0, 0) } : undefined} summary={`Closing balance ₹${(reportData.closingBalance || 0).toLocaleString()} compared with opening ₹${(reportData.openingBalance || 0).toLocaleString()}`} title="Closing Balance" value={`₹${(reportData.closingBalance || 0).toLocaleString()}`} tone="neutral" icon={<FiDollarSign className="h-[17px] w-[17px]" />} />
              </div>

              <ScrollX>
                <table className="w-full border-collapse text-[12.5px]">
                  <thead className="bg-[#FAFCFB] dark:bg-surface-base/60">
                    <tr>
                      {['Date', 'Description', 'Category', 'Debit', 'Credit', 'Balance'].map(h => (
                        <th key={h} className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-soft dark:divide-surface-border">
                    {(reportData.entries || []).map((entry: any, i: number) => (
                      <tr key={i} className="hover:bg-[#F6FAF8] dark:hover:bg-surface-hover/60">
                        <td className="px-3.5 py-2 text-[12.5px] text-[#18231E] dark:text-surface-text whitespace-nowrap">{new Date(entry.date).toLocaleDateString()}</td>
                        <td className="px-3.5 py-2 text-[12.5px] text-[#18231E] dark:text-surface-text">{entry.description}</td>
                        <td className="px-3.5 py-2 text-[12.5px] text-[#5B6963] dark:text-surface-muted">{entry.category}</td>
                        <td className="px-3.5 py-2 text-[12.5px] text-red-600">{entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : '-'}</td>
                        <td className="px-3.5 py-2 text-[12.5px] text-primary-600">{entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : '-'}</td>
                        <td className={`px-3.5 py-2 text-[12.5px] font-medium ${entry.balance >= 0 ? 'text-primary-700' : 'text-red-700'}`}>₹{entry.balance.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollX>
            </>
          )}

        </div>
      </Card>
    </div>
  );
}
