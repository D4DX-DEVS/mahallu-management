import { useState } from 'react';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Alert from '@/components/ui/Alert';
import Pagination from '@/components/ui/Pagination';
import { PageSkeleton } from '@/components/ui/Skeleton';
import {
  accountingReportService,
  DayBookEntry,
  DayBookSummary,
  ReportPagination,
} from '@/services/accountingReportService';
import { loadErrorInfo, LoadErrorInfo } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

export default function MahalluDayBook() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoadErrorInfo | null>(null);
  const [entries, setEntries] = useState<DayBookEntry[]>([]);
  /* Whole-range totals and the current page's position, both from the server. */
  const [summary, setSummary] = useState<DayBookSummary | null>(null);
  const [pagination, setPagination] = useState<ReportPagination | null>(null);
  /* The dates the report was generated with: paging must not pick up later edits to the inputs. */
  const [applied, setApplied] = useState<{ startDate: string; endDate: string } | null>(null);
  const [pageSize, setPageSize] = useState(50);
  const [paging, setPaging] = useState(false);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const loadPage = async (
    range: { startDate: string; endDate: string },
    page: number,
    limit: number,
    isNewReport: boolean
  ) => {
    try {
      if (isNewReport) setLoading(true);
      else setPaging(true);
      setError(null);
      const data = await accountingReportService.getDayBook({ ...range, scope: 'mahallu', page, limit });
      setEntries(data.entries);
      setSummary(data.summary);
      setPagination(data.pagination);
    } catch (err: any) {
      setError(loadErrorInfo(err, 'day book'));
    } finally {
      setLoading(false);
      setPaging(false);
    }
  };

  const fetchData = async () => {
    const range = { startDate, endDate };
    setApplied(range);
    await loadPage(range, 1, pageSize, true);
  };

  const changePage = (page: number) => {
    if (applied) loadPage(applied, page, pageSize, false);
  };

  const changePageSize = (size: number) => {
    setPageSize(size);
    if (applied) loadPage(applied, 1, size, false);
  };

  // Whole-range totals from the server, so they are right on every page.
  const totalIncome = summary?.totalIncome ?? 0;
  const totalExpense = summary?.totalExpense ?? 0;
  const netBalance = summary?.netBalance ?? totalIncome - totalExpense;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mahallu Day Book"
        description="Chronological record of Mahallu transactions"
        breadcrumbs={[{ label: 'Mahallu Finance', path: '/mahallu-finance/accounts' }]}
      />

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
          <Button onClick={fetchData} disabled={loading}>
            {loading ? 'Loading...' : 'Generate'}
          </Button>
        </div>

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <Alert
            variant={error.variant}
            title={error.title}
            action={error.variant === 'info' ? undefined : { label: 'Try again', onClick: fetchData }}
          >
            {error.message}
          </Alert>
        ) : entries.length === 0 ? (
          <p className="text-center py-10 text-gray-500">Select a date range and click "Generate"</p>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              <StatCard title="Total Income" value={<>₹{totalIncome.toLocaleString()}</>} tone="success" />
              <StatCard
                title="Total Expense"
                value={<>₹{totalExpense.toLocaleString()}</>}
                tone="destructive"
              />
              <StatCard
                title="Net Balance"
                value={<>₹{netBalance.toLocaleString()}</>}
                tone="info"
              />
            </div>
            <div className={paging ? 'overflow-x-auto opacity-60 pointer-events-none' : 'overflow-x-auto'}>
              <table className="data-table min-w-full divide-y divide-border">
                <thead className="bg-muted">
                  <tr>
                    {['Date', 'Description', 'Type', 'Ledger', 'Category', 'Amount'].map((h) => (
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
                  {entries.map((entry, i) => (
                    <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {new Date(entry.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {entry.description}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${entry.type === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                        >
                          {entry.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {toTitleCase(entry.ledgerName)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {toTitleCase(entry.categoryName)}
                      </td>
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
            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  onPageChange={changePage}
                  onItemsPerPageChange={changePageSize}
                  entity="entries"
                />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
