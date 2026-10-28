import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import DateRangePicker from '@/components/ui/DateRangePicker';
import { todayISO, yearStartISO } from '@/utils/dates';
import Select from '@/components/ui/Select';
import Alert from '@/components/ui/Alert';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { accountingReportService, TrialBalanceEntry } from '@/services/accountingReportService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import { loadErrorInfo, LoadErrorInfo } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import { fetchAllPages } from '@/services/api';
import { logError } from '@/utils/safeLog';
import {
  TRIAL_BALANCE_COLUMNS,
  TRIAL_BALANCE_MIN_WIDTH,
  formatRupees,
  summarizeTrialBalance,
  trialBalanceFooter,
  type FooterRow,
} from '@/utils/trialBalance';

// Amount cells: right-aligned, equal-width digits so figures line up, never wrapped.
const AMOUNT_CELL = 'px-4 py-3 text-sm text-right tabular-nums whitespace-nowrap';

const FOOTER_TONE: Record<FooterRow['tone'], string> = {
  neutral: 'text-gray-900 dark:text-gray-100',
  balanced: 'text-green-600',
  unbalanced: 'text-red-600',
};

export default function TrialBalance() {
  const { currentInstituteId: userInstituteId } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LoadErrorInfo | null>(null);
  const [entries, setEntries] = useState<TrialBalanceEntry[]>([]);
  const [institutes, setInstitutes] = useState<{ id: string; name: string }[]>([]);
  const [instituteFilter, setInstituteFilter] = useState(userInstituteId || 'all');
  const [startDate, setStartDate] = useState(() => yearStartISO());
  const [endDate, setEndDate] = useState(() => todayISO());

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

  const fetchTrialBalance = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { startDate, endDate };
      if (instituteFilter !== 'all') params.instituteId = instituteFilter;
      const data = await accountingReportService.getTrialBalance(params);
      setEntries(data || []);
    } catch (err: any) {
      setError(loadErrorInfo(err, 'trial balance'));
    } finally {
      setLoading(false);
    }
  };

  const footer = trialBalanceFooter(summarizeTrialBalance(entries));

  return (
    <div className="space-y-4">
      <PageHeader title="Trial Balance" description="Summary of all ledger balances" />

      <Card>
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div className="w-full sm:w-72">
            <DateRangePicker
              label="Date range"
              from={startDate}
              to={endDate}
              onChange={(from, to) => {
                setStartDate(from);
                setEndDate(to);
              }}
              className="h-10 max-sm:h-10"
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
          <Button onClick={fetchTrialBalance} disabled={loading}>
            {loading ? 'Loading...' : 'Generate'}
          </Button>
        </div>

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <Alert
            variant={error.variant}
            title={error.title}
            action={error.variant === 'info' ? undefined : { label: 'Try again', onClick: fetchTrialBalance }}
          >
            {error.message}
          </Alert>
        ) : entries.length === 0 ? (
          <div className="text-center py-10 text-gray-500 dark:text-gray-400">
            Select a date range and click "Generate" to view the trial balance
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Fixed layout: the columns are the same width in the header, every row and the footer. */}
            <table
              className="data-table w-full divide-y divide-border"
              style={{ tableLayout: 'fixed', minWidth: TRIAL_BALANCE_MIN_WIDTH }}
            >
              <colgroup>
                {TRIAL_BALANCE_COLUMNS.map((column) => (
                  <col key={column.key} style={column.width ? { width: column.width } : undefined} />
                ))}
              </colgroup>
              <thead className="bg-muted">
                <tr>
                  {TRIAL_BALANCE_COLUMNS.map((column) => (
                    <th
                      key={column.key}
                      scope="col"
                      // Inline: `.data-table th` sets text-align:left and would beat a `text-right` class.
                      style={{ textAlign: column.align }}
                      className="px-4 py-3 text-label font-medium text-gray-500 dark:text-gray-400 uppercase"
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-900 divide-y divide-border">
                {entries.map((entry, idx) => (
                  <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 font-medium break-words">
                      {toTitleCase(entry.ledgerName)}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
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
                    <td className={`${AMOUNT_CELL} text-gray-900 dark:text-gray-100`}>
                      {entry.debit > 0 ? formatRupees(entry.debit) : '-'}
                    </td>
                    <td className={`${AMOUNT_CELL} text-gray-900 dark:text-gray-100`}>
                      {entry.credit > 0 ? formatRupees(entry.credit) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-muted">
                {[footer.total, footer.difference].map((row) => (
                  <tr key={row.label}>
                    <td colSpan={row.labelSpan} className={`px-4 py-3 text-sm font-semibold ${FOOTER_TONE.neutral}`}>
                      {row.label}
                    </td>
                    <td className={`${AMOUNT_CELL} font-semibold ${FOOTER_TONE[row.tone]}`}>{row.debit}</td>
                    <td className={`${AMOUNT_CELL} font-semibold ${FOOTER_TONE[row.tone]}`}>{row.credit}</td>
                  </tr>
                ))}
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
