import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { accountingReportService } from '@/services/accountingReportService';
import { masterAccountService } from '@/services/masterAccountService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';

interface LedgerReportEntry {
  _id: string;
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
      setLedgers(result.data.map((l: any) => ({ id: l.id || l._id, name: l.name, type: l.type })));
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
      setError(err.response?.data?.message || 'Failed to fetch ledger report');
    } finally {
      setLoading(false);
    }
  };

  const entries: LedgerReportEntry[] = reportData?.entries || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Ledger Report</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Detailed transactions for a specific ledger with running balance</p>
        </div>
        <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Ledger Report' }]} />
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-4 mb-6">
          <div className="w-52">
            <Select
              label="Ledger"
              options={[{ value: '', label: 'Select Ledger' }, ...ledgers.map(l => ({ value: l.id, label: `${l.name} (${l.type})` }))]}
              value={selectedLedger}
              onChange={(e) => setSelectedLedger(e.target.value)}
            />
          </div>
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
          <Button onClick={fetchReport} disabled={loading || !selectedLedger}>
            {loading ? 'Loading...' : 'Generate'}
          </Button>
        </div>

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-12"><p className="text-red-600 dark:text-red-400">{error}</p></div>
        ) : !reportData ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            Select a ledger and click "Generate" to view the report
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Ledger</p>
                <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{reportData.ledger?.name || '-'}</p>
                <p className="text-xs text-gray-500">{reportData.ledger?.type}</p>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-600 dark:text-blue-400">Opening Balance</p>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">₹{(reportData.openingBalance || 0).toLocaleString()}</p>
              </div>
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-sm text-green-600 dark:text-green-400">Total Credit</p>
                <p className="text-xl font-bold text-green-700 dark:text-green-300">₹{(reportData.totalCredit || 0).toLocaleString()}</p>
              </div>
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <p className="text-sm text-purple-600 dark:text-purple-400">Closing Balance</p>
                <p className="text-xl font-bold text-purple-700 dark:text-purple-300">₹{(reportData.closingBalance || 0).toLocaleString()}</p>
              </div>
            </div>

            {entries.length === 0 ? (
              <div className="text-center py-8 text-gray-500">No transactions found for this period</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Source</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Debit</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Credit</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {/* Opening Balance Row */}
                    <tr className="bg-blue-50/50 dark:bg-blue-900/10">
                      <td className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300" colSpan={5}>Opening Balance</td>
                      <td className="px-4 py-2 text-sm text-right font-bold text-blue-700 dark:text-blue-300">₹{(reportData.openingBalance || 0).toLocaleString()}</td>
                    </tr>
                    {entries.map((entry) => (
                      <tr key={entry._id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                          {new Date(entry.date).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{entry.description}</td>
                        <td className="px-4 py-3 text-sm">
                          {entry.source && entry.source !== 'manual' ? (
                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">{entry.source}</span>
                          ) : (
                            <span className="text-gray-400">manual</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-red-600 dark:text-red-400">
                          {entry.debit > 0 ? `₹${entry.debit.toLocaleString()}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">
                          {entry.credit > 0 ? `₹${entry.credit.toLocaleString()}` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-gray-100">
                          ₹{entry.balance.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                    {/* Closing Balance Row */}
                    <tr className="bg-purple-50/50 dark:bg-purple-900/10">
                      <td className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300" colSpan={3}>Closing Balance</td>
                      <td className="px-4 py-2 text-sm text-right font-bold text-red-700 dark:text-red-300">₹{(reportData.totalDebit || 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right font-bold text-green-700 dark:text-green-300">₹{(reportData.totalCredit || 0).toLocaleString()}</td>
                      <td className="px-4 py-2 text-sm text-right font-bold text-purple-700 dark:text-purple-300">₹{(reportData.closingBalance || 0).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
