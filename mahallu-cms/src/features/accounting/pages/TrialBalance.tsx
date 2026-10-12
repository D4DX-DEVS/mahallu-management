import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import Alert from '@/components/ui/Alert';
import FilterBar from '@/components/ui/FilterBar';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import DateRangePicker from '@/components/ui/DateRangePicker';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { accountingReportService, TrialBalanceEntry } from '@/services/accountingReportService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import { getFriendlyError } from '@/utils/apiMessages';
import ScrollX from '@/features/_shared/ScrollX';

export default function TrialBalance() {
  const { currentInstituteId: userInstituteId } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [entries, setEntries] = useState<TrialBalanceEntry[]>([]);
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

  const fetchTrialBalance = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { startDate, endDate };
      if (instituteFilter !== 'all') params.instituteId = instituteFilter;
      const data = await accountingReportService.getTrialBalance(params);
      setEntries(data || []);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load trial balance. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
  const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Trial Balance" description="Summary of all ledger balances" />

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
          <Button onClick={fetchTrialBalance} disabled={loading}>
            {loading ? 'Loading...' : 'Generate'}
          </Button>
        </FilterBar>

        <div className="p-3.5">
          {loading ? (
            <div className="flex justify-center items-center py-12"><LoadingSpinner /></div>
          ) : error ? (
            <Alert tone="danger">{error}</Alert>
          ) : entries.length === 0 ? (
            <EmptyState title="Nothing to show yet" description='Select a date range and click "Generate" to view the trial balance' />
          ) : (
            <ScrollX>
              <table className="w-full border-collapse text-[12.5px]">
                <thead className="bg-[#FAFCFB] dark:bg-surface-base/60">
                  <tr>
                    <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Ledger</th>
                    <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Type</th>
                    <th className="whitespace-nowrap px-3.5 py-2.5 text-right text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Debit (₹)</th>
                    <th className="whitespace-nowrap px-3.5 py-2.5 text-right text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">Credit (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft bg-white dark:divide-surface-border dark:bg-surface-card">
                  {entries.map((entry, idx) => (
                    <tr key={idx} className="hover:bg-[#F6FAF8] dark:hover:bg-surface-hover/60">
                      <td className="px-3.5 py-2 text-[12.5px] text-[#18231E] dark:text-surface-text font-medium">{entry.ledgerName}</td>
                      <td className="px-3.5 py-2 text-[12.5px]">
                        <Badge variant={entry.type === 'income' ? 'success' : entry.type === 'bank' ? 'info' : 'danger'} dot className="capitalize">{entry.type}</Badge>
                      </td>
                      <td className="px-3.5 py-2 text-[12.5px] text-right text-[#18231E] dark:text-surface-text">
                        {entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-3.5 py-2 text-[12.5px] text-right text-[#18231E] dark:text-surface-text">
                        {entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-[#FAFCFB] dark:bg-surface-base/60">
                  <tr>
                    <td colSpan={2} className="px-3.5 py-2 text-[12.5px] font-bold text-[#18231E] dark:text-surface-text">Total</td>
                    <td className="px-3.5 py-2 text-[12.5px] text-right font-bold text-[#18231E] dark:text-surface-text">₹{totalDebit.toLocaleString()}</td>
                    <td className="px-3.5 py-2 text-[12.5px] text-right font-bold text-[#18231E] dark:text-surface-text">₹{totalCredit.toLocaleString()}</td>
                  </tr>
                  <tr>
                    <td colSpan={2} className="px-3.5 py-2 text-[12.5px] font-bold text-[#18231E] dark:text-surface-text">Difference</td>
                    <td colSpan={2} className={`px-3.5 py-2 text-[12.5px] text-right font-bold ${
                      totalDebit - totalCredit === 0 ? 'text-primary-600' : 'text-red-600'
                    }`}>
                      ₹{Math.abs(totalDebit - totalCredit).toLocaleString()}
                      {totalDebit - totalCredit === 0 && ' (Balanced ✓)'}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </ScrollX>
          )}

        </div>
      </Card>
    </div>
  );
}
