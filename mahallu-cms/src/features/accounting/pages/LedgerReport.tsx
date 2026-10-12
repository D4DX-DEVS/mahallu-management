import { useState, useEffect } from 'react';
import { FiTrendingUp, FiDollarSign } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
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
import { masterAccountService } from '@/services/masterAccountService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import { getFriendlyError } from '@/utils/apiMessages';
import ScrollX from '@/features/_shared/ScrollX';

interface LedgerReportEntry {
  id: string;
  date: string;
  description: string;
  category?: string;
  institute?: string;
  debit: number;
  credit: number;
  balance: number;
  paymentMethod?: string;
  referenceNo?: string;
  source?: string;
}

export default function LedgerReport() {
  const { currentInstituteId: userInstituteId } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ledgers, setLedgers] = useState<{ id: string; name: string; type: string }[]>([]);
  const [institutes, setInstitutes] = useState<{ id: string; name: string }[]>([]);
  const [selectedLedger, setSelectedLedger] = useState('');
  const [instituteFilter, setInstituteFilter] = useState(userInstituteId || 'all');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [reportData, setReportData] = useState<any>(null);

  useEffect(() => {
    fetchLedgers();
    if (!userInstituteId) fetchInstitutes();
  }, []);

  const fetchLedgers = async () => {
    try {
      const result = await masterAccountService.getAllLedgers({ limit: 1000 });
      setLedgers(result.data.map((l: any) => ({ id: l.id, name: l.name, type: l.type })));
    } catch (err) { console.error('Error fetching ledgers:', err); }
  };

  const fetchInstitutes = async () => {
    try {
      const result = await instituteService.getAll({ limit: 1000 });
      setInstitutes(result.data.map((i: any) => ({ id: i.id, name: i.name })));
    } catch (err) { console.error('Error:', err); }
  };

  const fetchReport = async () => {
    if (!selectedLedger) return;
    try {
      setLoading(true);
      setError(null);
      const params: any = { ledgerId: selectedLedger, startDate, endDate };
      if (instituteFilter !== 'all') params.instituteId = instituteFilter;
      const data = await accountingReportService.getLedgerReport(params);
      setReportData(data);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load ledger report. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  const entries: LedgerReportEntry[] = reportData?.entries || [];

  return (
    <div className="space-y-4">
      <PageHeader title="Ledger Report" description="Detailed transactions for a specific ledger with running balance" />

      <Card padding="none" className="overflow-visible">
        <FilterBar className="items-end">
          <div className="w-52">
            <Select
              label="Ledger"
              options={[{ value: '', label: 'Select Ledger' }, ...ledgers.map(l => ({ value: l.id, label: `${l.name} (${l.type})` }))]}
              value={selectedLedger}
              onChange={(e) => setSelectedLedger(e.target.value)}
            />
          </div>
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
          <Button onClick={fetchReport} disabled={loading || !selectedLedger}>
            {loading ? 'Loading...' : 'Generate'}
          </Button>
        </FilterBar>

        <div className="p-3.5">
          {loading ? (
            <div className="flex justify-center items-center py-12"><LoadingSpinner /></div>
          ) : error ? (
            <Alert tone="danger">{error}</Alert>
          ) : !reportData ? (
            <EmptyState title="Nothing to show yet" description='Select a ledger and click "Generate" to view the report' />
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                <div className="rounded-xl bg-[#F4F7F5] p-4 dark:bg-surface-raised">
                  <p className="text-sm text-[#5B6963] dark:text-surface-muted">Ledger</p>
                  <p className="text-lg font-bold text-[#18231E] dark:text-surface-text">{reportData.ledger?.name || '-'}</p>
                  <p className="text-xs text-[#7B8983] dark:text-surface-muted">{reportData.ledger?.type}</p>
                </div>
                <StatCard variant="inline" title="Opening Balance" value={`₹${(reportData.openingBalance || 0).toLocaleString()}`} tone="neutral" icon={<FiDollarSign className="h-[17px] w-[17px]" />} />
                <StatCard variant="inline" title="Total Credit" value={`₹${(reportData.totalCredit || 0).toLocaleString()}`} tone="green" icon={<FiTrendingUp className="h-[17px] w-[17px]" />} />
                <StatCard variant="inline" viz={Math.max(reportData.openingBalance || 0, reportData.closingBalance || 0) > 0 ? { type: 'pair', a: Math.max(reportData.openingBalance || 0, 0), b: Math.max(reportData.closingBalance || 0, 0) } : undefined} summary={`Closing balance ₹${(reportData.closingBalance || 0).toLocaleString()} compared with opening ₹${(reportData.openingBalance || 0).toLocaleString()}`} title="Closing Balance" value={`₹${(reportData.closingBalance || 0).toLocaleString()}`} tone="neutral" icon={<FiDollarSign className="h-[17px] w-[17px]" />} />
              </div>

              {entries.length === 0 ? (
                <EmptyState title="Nothing to show yet" description='No transactions found for this period' />
              ) : (
                <ScrollX>
                  <table className="w-full border-collapse text-[12.5px]">
                    <thead className="bg-[#FAFCFB] dark:bg-surface-base/60">
                      <tr>
                        <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Date</th>
                        <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Description</th>
                        <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Source</th>
                        <th className="whitespace-nowrap px-3.5 py-2.5 text-right text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Debit</th>
                        <th className="whitespace-nowrap px-3.5 py-2.5 text-right text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Credit</th>
                        <th className="whitespace-nowrap px-3.5 py-2.5 text-right text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line-soft bg-white dark:divide-surface-border dark:bg-surface-card">
                      {/* Opening Balance Row */}
                      <tr className="bg-blue-50/50 dark:bg-blue-900/10">
                        <td className="px-3.5 py-2 text-[12.5px] font-medium text-[#3A4741] dark:text-surface-text" colSpan={5}>Opening Balance</td>
                        <td className="px-3.5 py-2 text-[12.5px] text-right font-bold text-blue-700 dark:text-blue-300">₹{(reportData.openingBalance || 0).toLocaleString()}</td>
                      </tr>
                      {entries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-[#F6FAF8] dark:hover:bg-surface-hover/60">
                          <td className="px-3.5 py-2 text-[12.5px] text-[#18231E] dark:text-surface-text whitespace-nowrap">
                            {new Date(entry.date).toLocaleDateString()}
                          </td>
                          <td className="px-3.5 py-2 text-[12.5px] text-[#18231E] dark:text-surface-text">{entry.description}</td>
                          <td className="px-3.5 py-2 text-[12.5px]">
                            {entry.source && entry.source !== 'manual' ? (
                              <Badge variant="warning">{entry.source}</Badge>
                            ) : (
                              <span className="text-[#98A59F] dark:text-surface-muted">manual</span>
                            )}
                          </td>
                          <td className="px-3.5 py-2 text-[12.5px] text-right text-[#B3261E] dark:text-red-300">
                            {entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : '-'}
                          </td>
                          <td className="px-3.5 py-2 text-[12.5px] text-right text-primary-600 dark:text-primary-400">
                            {entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : '-'}
                          </td>
                          <td className="px-3.5 py-2 text-[12.5px] text-right font-medium text-[#18231E] dark:text-surface-text">
                            ₹{entry.balance.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {/* Closing Balance Row */}
                      <tr className="bg-purple-50/50 dark:bg-purple-900/10">
                        <td className="px-3.5 py-2 text-[12.5px] font-medium text-[#3A4741] dark:text-surface-text" colSpan={3}>Closing Balance</td>
                        <td className="px-3.5 py-2 text-[12.5px] text-right font-bold text-red-700 dark:text-red-300">₹{(reportData.totalDebit || 0).toLocaleString()}</td>
                        <td className="px-3.5 py-2 text-[12.5px] text-right font-bold text-primary-700 dark:text-primary-300">₹{(reportData.totalCredit || 0).toLocaleString()}</td>
                        <td className="px-3.5 py-2 text-[12.5px] text-right font-bold text-purple-700 dark:text-purple-300">₹{(reportData.closingBalance || 0).toLocaleString()}</td>
                      </tr>
                    </tbody>
                  </table>
                </ScrollX>
              )}
            </>
          )}

        </div>
      </Card>
    </div>
  );
}
