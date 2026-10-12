import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAlertCircle, FiCheckCircle, FiDollarSign, FiDownload, FiSend, FiMapPin } from 'react-icons/fi';
import { PersonCell } from '@/components/ui/Avatar';
import RowActions from '@/components/ui/RowActions';
import GradeChip from '@/components/ui/GradeChip';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Tabs from '@/components/ui/Tabs';
import Modal from '@/components/ui/Modal';
import { TableColumn } from '@/types';
import { collectibleService, FamilyDue, DuesSummary, DuesStatus, ReminderPreview } from '@/services/collectibleService';
import { useDebounce } from '@/hooks/useDebounce';
import { exportToCSV } from '@/utils/exportUtils';
import { pct } from '@/utils/statSeries';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { ROUTES } from '@/constants/routes';

type Tab = 'all' | DuesStatus;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** '2026-03' -> 'Mar 2026' */
const monthText = (key?: string | null) => {
  const m = key ? /^(\d{4})-(\d{2})$/.exec(key) : null;
  return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : '';
};
const rupees = (n?: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

export default function LiveDues() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [dues, setDues] = useState<FamilyDue[]>([]);
  const [summary, setSummary] = useState<DuesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);

  // Reminder dialog: null = closed. familyIds undefined = everyone with dues.
  const [reminder, setReminder] = useState<{ familyIds?: string[]; label: string } | null>(null);
  const [preview, setPreview] = useState<ReminderPreview | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await collectibleService.getFamilyDues({
        search: debouncedSearch || undefined,
        status: tab === 'all' ? undefined : tab,
      });
      setDues(result.dues);
      setSummary(result.summary);
    } catch (err: any) {
      setError(getFriendlyError(err, "We couldn't load the dues. Please try again."));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, tab]);

  useEffect(() => {
    load();
    setSelected([]);
  }, [load]);

  // Always dry-run first when the dialog opens, so the admin sees exactly who gets what.
  useEffect(() => {
    if (!reminder) return;
    let cancelled = false;
    setPreview(null);
    setPreviewError(null);
    collectibleService
      .sendDueReminders({ dryRun: true, familyIds: reminder.familyIds })
      .then((p) => !cancelled && setPreview(p))
      .catch((e) => !cancelled && setPreviewError(getFriendlyError(e, "We couldn't prepare the reminders. Try again in a moment.")));
    return () => {
      cancelled = true;
    };
  }, [reminder]);

  const confirmSend = async () => {
    if (!reminder) return;
    setSending(true);
    try {
      const r = await collectibleService.sendDueReminders({ dryRun: false, familyIds: reminder.familyIds });
      toast.success(
        r.delivery === 'dev-stub'
          ? `Test server: ${r.willSend} reminders prepared, nothing was sent.`
          : `Sending ${r.willSend} reminders on WhatsApp. This can take a few minutes.`
      );
      setReminder(null);
    } catch (e: any) {
      toast.error(getFriendlyError(e, 'Reminders could not be sent. Try again in a moment.'));
    } finally {
      setSending(false);
    }
  };

  const counts = summary?.statusCounts;
  const tabs: Array<{ value: Tab; label: string; count?: number }> = [
    { value: 'all' as Tab, label: 'All', count: counts?.all },
    { value: 'overdue' as Tab, label: 'Overdue', count: counts?.overdue },
    { value: 'due' as Tab, label: 'Due', count: counts?.due },
    { value: 'clear' as Tab, label: 'Clear', count: counts?.clear },
    { value: 'ahead' as Tab, label: 'Paid ahead', count: counts?.ahead },
  ];

  const statusBadge = (d: FamilyDue) => {
    switch (d.status) {
      case 'overdue':
        return <Badge variant="danger" dot>Overdue{d.oldestUnpaidMonth ? ` since ${monthText(d.oldestUnpaidMonth)}` : ''}</Badge>;
      case 'due':
        return <Badge variant="warning" dot>Due this month</Badge>;
      case 'ahead':
        return <Badge variant="info" dot>Paid ahead {d.aheadMonths} {d.aheadMonths === 1 ? 'month' : 'months'}</Badge>;
      default:
        return <Badge variant="success" dot>Paid up</Badge>;
    }
  };

  const columns: TableColumn<FamilyDue>[] = [
    { key: 'houseName', label: 'House', render: (v, row) => (
      <PersonCell name={v} subtitle={`${row.familyHead || '-'}${row.wardNumber ? ` · Ward ${row.wardNumber}` : ''}`} />
    ) },
    { key: 'varisangyaGrade', label: 'Grade', render: (v) => <GradeChip value={v} /> },
    { key: 'monthlyAmount', label: 'Monthly', align: 'right', render: (v) => rupees(v) },
    { key: 'expectedAmount', label: 'Billed', align: 'right', render: (v, row) => (
      <span title={`${row.monthsBilled ?? 0} months`}>{rupees(v)}</span>
    ) },
    { key: 'paidAmount', label: 'Paid', align: 'right', render: (v) => rupees(v) },
    { key: 'dueAmount', label: 'Balance', align: 'right', render: (v, row) =>
      v > 0 ? (
        <div>
          <span className="font-semibold text-red-600 dark:text-red-400">{rupees(v)}</span>
          {row.oldestMonthBalance != null && row.oldestMonthBalance > 0 && row.oldestMonthBalance < row.monthlyAmount && (
            <div className="text-[12px] text-[#5B6963] dark:text-surface-muted">part paid: {rupees(row.oldestMonthBalance)} left on {monthText(row.oldestUnpaidMonth)}</div>
          )}
        </div>
      ) : (
        <span className="font-medium text-primary-600 dark:text-primary-400">{rupees(0)}</span>
      ) },
    { key: 'status', label: 'Status', render: (_, row) => statusBadge(row) },
    { key: 'actions', label: 'Actions', hideable: false, render: (_, row) => (
      <RowActions
        onView={() => navigate(ROUTES.FAMILIES.DETAIL(row.familyId))}
        ariaLabels={{ view: 'View family' }}
        extra={[
          { label: 'Remind', icon: <FiSend />, onClick: () => setReminder({ familyIds: [row.familyId], label: row.houseName }), show: row.dueAmount > 0, disabledReason: row.contactNo ? undefined : 'No phone number on file' },
          { label: 'Collect now', icon: <FiDollarSign />, onClick: () => navigate(`${ROUTES.COLLECTIBLES.QUICK}?family=${row.familyId}`) },
        ]}
      />
    ) },
  ];

  const exportColumns: TableColumn<FamilyDue>[] = [
    { key: 'houseName', label: 'House Name' },
    { key: 'familyHead', label: 'Family Head' },
    { key: 'wardNumber', label: 'Ward' },
    { key: 'varisangyaGrade', label: 'Grade' },
    { key: 'monthlyAmount', label: 'Monthly' },
    { key: 'monthsBilled', label: 'Months billed' },
    { key: 'expectedAmount', label: 'Billed' },
    { key: 'paidAmount', label: 'Paid' },
    { key: 'dueAmount', label: 'Balance' },
    { key: 'oldestUnpaidMonth', label: 'Oldest unpaid month' },
    { key: 'aheadMonths', label: 'Paid ahead (months)' },
    { key: 'status', label: 'Status' },
  ];

  const withDues = useMemo(() => dues.filter((d) => d.dueAmount > 0), [dues]);
  const wardValues = (summary?.wardArrears || []).map((w) => w.amount);
  const topWard = summary?.wardArrears?.[0];
  const overdueCount = counts?.overdue ?? 0;
  const rate = summary?.collectionRate ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Live dues"
        description="Who has paid their monthly varisangya, who is behind, and who has paid ahead. Billing starts from the month each family joined."
        actions={
          <Button onClick={() => setReminder({ familyIds: undefined, label: 'every family with dues' })} disabled={!summary || summary.familiesWithDues === 0}>
            <FiSend className="h-3.5 w-3.5" />
            Send reminders
          </Button>
        }
      />

      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard variant="inline" tone="lime" title="Collected so far" value={`${rate}%`}
            viz={summary.totalExpected > 0 ? { type: 'ring', percent: rate } : undefined}
            summary={`${rupees(summary.totalPaid)} paid against ${rupees(summary.totalExpected)} billed, collection rate ${rate} percent`}
            icon={<FiCheckCircle className="h-[17px] w-[17px]" />} />
          <StatCard variant="inline" tone="neutral" title="Still to collect" value={rupees(summary.totalDue)}
            summary={`${rupees(summary.totalDue)} outstanding, of which ${rupees(summary.totalOverdue)} is from earlier months`}
            icon={<FiDollarSign className="h-[17px] w-[17px]" />} />
          <StatCard variant="inline" tone="gold" title="Families behind" value={overdueCount}
            viz={overdueCount > 0 ? { type: 'dots', count: overdueCount } : undefined}
            summary={`${overdueCount} families have unpaid months before this one, ${counts?.due ?? 0} owe only this month`}
            icon={<FiAlertCircle className="h-[17px] w-[17px]" />} />
          <StatCard variant="inline" tone="neutral" title="Biggest ward arrears" value={topWard ? `Ward ${topWard.ward}` : 'None'}
            viz={wardValues.length > 0 ? { type: 'ladder', values: wardValues } : undefined}
            summary={topWard ? `Ward ${topWard.ward} owes ${rupees(topWard.amount)}, the most of any ward` : 'No ward has arrears'}
            icon={<FiMapPin className="h-[17px] w-[17px]" />} />
        </div>
      )}

      <Card padding="none" className="overflow-visible">
        <div className="px-3.5 pt-1">
          <Tabs<Tab> tabs={tabs} value={tab} onChange={setTab} aria-label="Dues status" />
        </div>
        <FilterBar
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search by house or family head' }}
          actions={
            <Button variant="secondary" onClick={() => exportToCSV(exportColumns, dues, 'varisangya-dues')}>
              <FiDownload className="h-3.5 w-3.5" />
              Export
            </Button>
          }
        />

        <div className="p-3.5">
          {error && (
            <Alert tone="danger" className="mb-3.5">
              {error}
            </Alert>
          )}

          {loading ? (
            <LoadingSpinner />
          ) : (
            <Table
              columns={columns}
              data={dues}
              emptyMessage={tab === 'all' ? 'No families found' : 'No families in this group'}
              showExport={false}
              selectable
              getRowId={(r) => r.familyId}
              selectedIds={selected}
              onSelectionChange={setSelected}
              bulkActions={(ids) => (
                <Button size="sm" onClick={() => setReminder({ familyIds: ids, label: `${ids.length} selected ${ids.length === 1 ? 'family' : 'families'}` })}>
                  <FiSend className="h-3 w-3" />Remind selected
                </Button>
              )}
              filtersActive={!!debouncedSearch || tab !== 'all'}
              onClearFilters={() => { setSearchQuery(''); setTab('all'); }}
            />
          )}
          {!loading && withDues.length > 0 && tab !== 'clear' && tab !== 'ahead' && (
            <p className="mt-2.5 text-[12px] text-[#5B6963] dark:text-surface-muted">
              Payments count if they are approved and recorded against the family or any of its members. Money is applied to the oldest month first.
            </p>
          )}
        </div>
      </Card>

      <Modal
        isOpen={!!reminder}
        onClose={() => !sending && setReminder(null)}
        title="Send varisangya reminders"
        description={reminder ? `WhatsApp message to ${reminder.label}` : undefined}
        size="md"
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" onClick={() => setReminder(null)} disabled={sending}>Cancel</Button>
            <Button onClick={confirmSend} isLoading={sending} disabled={!preview || preview.willSend === 0}>
              {preview ? `Send ${preview.willSend} ${preview.willSend === 1 ? 'reminder' : 'reminders'}` : 'Send'}
            </Button>
          </div>
        }
      >
        {previewError && <Alert tone="danger">{previewError}</Alert>}
        {!preview && !previewError && <LoadingSpinner />}
        {preview && (
          <div className="space-y-3 text-[13px]">
            <p>
              <strong>{preview.willSend}</strong> {preview.willSend === 1 ? 'family' : 'families'} will get a reminder.
              {preview.skippedNoPhone > 0 && <> {preview.skippedNoPhone} will be skipped because no valid phone number is saved.</>}
            </p>
            {preview.delivery === 'dev-stub' && (
              <Alert tone="warning">This is a test server. Messages are prepared but not sent.</Alert>
            )}
            {preview.sample[0] && (
              <div>
                <div className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-[#5B6963] dark:text-surface-muted">
                  Preview for {preview.sample[0].houseName}
                </div>
                <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-lg bg-[#F4F7F5] p-3 font-sans text-[12.5px] dark:bg-surface-raised">{preview.sample[0].message}</pre>
              </div>
            )}
            <p className="text-[12px] text-[#5B6963] dark:text-surface-muted">
              Each family is messaged once. Messages go out one by one, so a large list can take a few minutes.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
