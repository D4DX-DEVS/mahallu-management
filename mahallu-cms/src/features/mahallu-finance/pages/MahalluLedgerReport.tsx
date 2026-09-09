import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { accountingReportService } from '@/services/accountingReportService';
import { masterAccountService, Ledger } from '@/services/masterAccountService';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

export default function MahalluLedgerReport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [ledgerId, setLedgerId] = useState('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    masterAccountService
      .getAllLedgers({ limit: 1000, scope: 'mahallu' })
      .then((r) => setLedgers(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, []);

  const fetchData = async () => {
    if (!ledgerId) return;
    try {
      setLoading(true);
      setError(null);
      const result = await accountingReportService.getLedgerReport({
        ledgerId,
        startDate,
        endDate,
        scope: 'mahallu',
      });
      setReportData(result);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'ledger report'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mahallu Ledger Report"
        description="Detailed transactions for a Mahallu ledger"
        breadcrumbs={[{ label: 'Mahallu Finance', path: '/mahallu-finance/accounts' }]}
      />

      <Card>
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div className="w-full sm:w-56">
            <Select
              label="Ledger *"
              options={[
                { value: '', label: 'Select Ledger...' },
                ...ledgers.map((l) => ({ value: l.id, label: `${l.name} (${l.type})` })),
              ]}
              value={ledgerId}
              onChange={(e) => setLedgerId(e.target.value)}
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
          <Button onClick={fetchData} disabled={loading || !ledgerId}>
            {loading ? 'Loading...' : 'Generate'}
          </Button>
        </div>

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <p className="text-center py-8 text-red-600">{error}</p>
        ) : !reportData ? (
          <p className="text-center py-10 text-gray-500">
            Select a ledger and date range, then click "Generate"
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <StatCard
                title="Opening Balance"
                value={<>₹{(reportData.openingBalance || 0).toLocaleString()}</>}
              />
              <StatCard
                title="Total Debit"
                value={<>₹{(reportData.totalDebit || 0).toLocaleString()}</>}
                tone="destructive"
              />
              <StatCard
                title="Total Credit"
                value={<>₹{(reportData.totalCredit || 0).toLocaleString()}</>}
                tone="success"
              />
              <StatCard
                title="Closing Balance"
                value={<>₹{(reportData.closingBalance || 0).toLocaleString()}</>}
                tone="info"
              />
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    {['Date', 'Description', 'Category', 'Debit', 'Credit', 'Balance'].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-3 text-left text-label font-medium text-gray-500 dark:text-gray-400 uppercase"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {(reportData.entries || []).map((entry: any, i: number) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {new Date(entry.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {entry.description}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400 capitalize">{entry.category}</td>
                      <td className="px-4 py-3 text-sm text-red-600">
                        {entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-600">
                        {entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : '-'}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm font-medium ${entry.balance >= 0 ? 'text-green-700' : 'text-red-700'}`}
                      >
                        ₹{entry.balance.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
