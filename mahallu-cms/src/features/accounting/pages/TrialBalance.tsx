import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { accountingReportService, TrialBalanceEntry } from '@/services/accountingReportService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

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
    } catch (err) {
      console.error('Error:', err);
    }
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
      setError(loadErrorMessage(err, 'trial balance'));
    } finally {
      setLoading(false);
    }
  };

  const totalDebit = entries.reduce((sum, e) => sum + (e.debit || 0), 0);
  const totalCredit = entries.reduce((sum, e) => sum + (e.credit || 0), 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Trial Balance" description="Summary of all ledger balances" />

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
          <Button onClick={fetchTrialBalance} disabled={loading}>
            {loading ? 'Loading...' : 'Generate'}
          </Button>
        </div>

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            Select a date range and click "Generate" to view the trial balance
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted">
                <tr>
                  <th className="px-4 py-3 text-left text-label font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Ledger
                  </th>
                  <th className="px-4 py-3 text-left text-label font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Type
                  </th>
                  <th className="px-4 py-3 text-right text-label font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Debit (₹)
                  </th>
                  <th className="px-4 py-3 text-right text-label font-medium text-gray-500 dark:text-gray-400 uppercase">
                    Credit (₹)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-border">
                {entries.map((entry, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-medium">
                      {entry.ledgerName}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${
                          entry.type === 'income'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            : entry.type === 'bank'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                        }`}
                      >
                        {entry.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">
                      {entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">
                      {entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Total
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 dark:text-gray-100">
                    ₹{totalDebit.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 dark:text-gray-100">
                    ₹{totalCredit.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
                    Difference
                  </td>
                  <td
                    colSpan={2}
                    className={`px-4 py-3 text-sm text-right font-semibold ${
                      totalDebit - totalCredit === 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    ₹{Math.abs(totalDebit - totalCredit).toLocaleString()}
                    {totalDebit - totalCredit === 0 && ' (Balanced ✓)'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
