import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Alert from '@/components/ui/Alert';
import Pagination from '@/components/ui/Pagination';
import { PageSkeleton } from '@/components/ui/Skeleton';
import {
  accountingReportService,
  DayBookEntry,
  DayBookParams,
  DayBookSummary,
  ReportPagination,
} from '@/services/accountingReportService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import { loadErrorInfo, LoadErrorInfo } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import { fetchAllPages } from '@/services/api';
import { logError } from '@/utils/safeLog';

export default function DayBook() {
  const { currentInstituteId: userInstituteId } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoadErrorInfo | null>(null);
  const [entries, setEntries] = useState<DayBookEntry[]>([]);
  /* Whole-range totals and the current page's position, both from the server. */
  const [summary, setSummary] = useState<DayBookSummary | null>(null);
  const [pagination, setPagination] = useState<ReportPagination | null>(null);
  /* The filters the report was generated with: paging must not pick up later edits to the inputs. */
  const [appliedParams, setAppliedParams] = useState<Omit<DayBookParams, 'page' | 'limit'> | null>(null);
  const [pageSize, setPageSize] = useState(50);
  const [paging, setPaging] = useState(false);
  const [institutes, setInstitutes] = useState<{ id: string; name: string }[]>([]);
  const [instituteFilter, setInstituteFilter] = useState(userInstituteId || 'all');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (!userInstituteId) fetchInstitutes();
  }, []);

  const fetchInstitutes = async () => {
    try {
      const allRows = await fetchAllPages((page) => instituteService.getAll(page));
      setInstitutes(allRows.map((i: any) => ({ id: i.id, name: i.name })));
    } catch (err) {
      logError('Error', err);
    }
  };

  const loadPage = async (
    params: Omit<DayBookParams, 'page' | 'limit'>,
    page: number,
    limit: number,
    isNewReport: boolean
  ) => {
    try {
      if (isNewReport) setLoading(true);
      else setPaging(true);
      setError(null);
      const data = await accountingReportService.getDayBook({ ...params, page, limit });
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

  const fetchDayBook = async () => {
    const params: Omit<DayBookParams, 'page' | 'limit'> = { startDate, endDate };
    if (instituteFilter !== 'all') params.instituteId = instituteFilter;
    setAppliedParams(params);
    await loadPage(params, 1, pageSize, true);
  };

  const changePage = (page: number) => {
    if (appliedParams) loadPage(appliedParams, page, pageSize, false);
  };

  const changePageSize = (size: number) => {
    setPageSize(size);
    if (appliedParams) loadPage(appliedParams, 1, size, false);
  };

  // Whole-range totals from the server, so they are right on every page.
  const totalIncome = summary?.totalIncome ?? 0;
  const totalExpense = summary?.totalExpense ?? 0;
  const netBalance = summary?.netBalance ?? totalIncome - totalExpense;

  return (
    <div className="space-y-4">
      <PageHeader title="Day Book" description="Chronological record of all transactions" />

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
                  ...institutes.map((i) => ({ value: i.id, label: toTitleCase(i.name) })),
                ]}
                value={instituteFilter}
                onChange={(e) => setInstituteFilter(e.target.value)}
              />
            </div>
          )}
          <Button onClick={fetchDayBook} disabled={loading}>
            {loading ? 'Loading...' : 'Generate'}
          </Button>
        </div>

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <Alert
            variant={error.variant}
            title={error.title}
            action={error.variant === 'info' ? undefined : { label: 'Try again', onClick: fetchDayBook }}
          >
            {error.message}
          </Alert>
        ) : entries.length === 0 ? (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            {startDate
              ? 'No entries found for the selected period. Click "Generate" to load data.'
              : 'Select a date range and click "Generate"'}
          </div>
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
                    <th className="px-4 py-3 text-left text-label font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-label font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-label font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-label font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Ledger/Category
                    </th>
                    <th className="px-4 py-3 text-right text-label font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-border">
                  {entries.map((entry, idx) => (
                    <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {new Date(entry.date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                        {entry.description}
                        {entry.employeeName && (
                          <span className="text-gray-500 ml-1">({toTitleCase(entry.employeeName)})</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${
                            entry.type === 'income'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                              : entry.type === 'salary'
                                ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200'
                                : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                          }`}
                        >
                          {entry.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                        {toTitleCase(entry.ledgerName || entry.categoryName) || '-'}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm text-right font-medium ${
                          entry.type === 'income'
                            ? 'text-green-600 dark:text-green-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {entry.type === 'income' ? '+' : '-'}₹{entry.amount.toLocaleString()}
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
