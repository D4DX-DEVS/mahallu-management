import { useEffect, useState, useCallback } from 'react';
import { FiCheckCircle, FiAlertTriangle, FiLock, FiUnlock } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Table from '@/components/ui/Table';
import Alert from '@/components/ui/Alert';
import Stepper from '@/components/ui/Stepper';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import RowActions from '@/components/ui/RowActions';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { useAuthStore } from '@/store/authStore';
import { TableColumn } from '@/types';
import { formatINR } from '@/utils/formatINR';
import { periodService, FinancialPeriod, ClosePreview } from '@/services/financialService';

const fmtDate = (d?: string) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '-');

/** Suggest the next year: the day after the latest period, for twelve months (default 1 April to 31 March). */
const suggestNext = (periods: FinancialPeriod[]) => {
  const latestEnd = periods.reduce<Date | null>((acc, p) => {
    const e = new Date(p.endDate);
    return !acc || e > acc ? e : acc;
  }, null);
  const now = new Date();
  const start = latestEnd
    ? new Date(Date.UTC(latestEnd.getUTCFullYear(), latestEnd.getUTCMonth(), latestEnd.getUTCDate() + 1))
    : new Date(Date.UTC(now.getMonth() < 3 ? now.getFullYear() - 1 : now.getFullYear(), 3, 1));
  const end = new Date(Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate() - 1));
  const first = start.getUTCFullYear();
  return {
    name: `FY ${first}-${String((first + 1) % 100).padStart(2, '0')}`,
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
};

function Snapshot({ totals, ledgerTotals, balances, note }: {
  totals?: { income: number; expense: number; net: number };
  ledgerTotals?: ClosePreview['ledgerTotals'];
  balances?: ClosePreview['openingBalances'];
  note?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-3">
        {[
          { label: 'Income', value: totals?.income ?? 0 },
          { label: 'Expense', value: totals?.expense ?? 0 },
          { label: 'Surplus', value: totals?.net ?? 0 },
        ].map((t) => (
          <div key={t.label} className="rounded-xl border border-line p-2.5 dark:border-surface-border">
            <p className="text-[12px] font-bold uppercase tracking-[0.05em] text-[#6A7771] dark:text-surface-muted">{t.label}</p>
            <p className="mt-0.5 text-base font-bold text-[#18231E] dark:text-surface-text">{formatINR(t.value)}</p>
          </div>
        ))}
      </div>

      {!!ledgerTotals?.length && (
        <div>
          <p className="mb-1 text-xs font-bold text-[#18231E] dark:text-surface-text">By ledger</p>
          <div className="divide-y divide-line rounded-xl border border-line dark:divide-surface-border dark:border-surface-border">
            {ledgerTotals.map((l) => (
              <div key={`${l.ledgerId}-${l.type}`} className="flex items-center justify-between gap-2 px-3 py-1.5 text-[12.5px]">
                <span className="min-w-0 truncate text-[#3A4741] dark:text-surface-text">
                  {l.name} <span className="text-[#98A59F]">({l.type}, {l.count} entries)</span>
                </span>
                <span className="font-semibold tabular-nums">{formatINR(l.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!!balances?.length && (
        <div>
          <p className="mb-1 text-xs font-bold text-[#18231E] dark:text-surface-text">Account balances carried forward</p>
          <div className="divide-y divide-line rounded-xl border border-line dark:divide-surface-border dark:border-surface-border">
            {balances.map((b) => (
              <div key={b.accountId} className="flex items-center justify-between gap-2 px-3 py-1.5 text-[12.5px]">
                <span className="min-w-0 truncate text-[#3A4741] dark:text-surface-text">{b.name}</span>
                <span className="font-semibold tabular-nums">{formatINR(b.balance)}</span>
              </div>
            ))}
          </div>
          {note && <p className="mt-1 text-[12px] text-[#7B8983] dark:text-surface-muted">{note}</p>}
        </div>
      )}
    </div>
  );
}

export default function MahalluFinancialPeriods() {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const canReopen = isSuperAdmin || user?.permissions?.financeAdmin === true;

  const [periods, setPeriods] = useState<FinancialPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', startDate: '', endDate: '' });
  const [creating, setCreating] = useState(false);

  const [wizardFor, setWizardFor] = useState<FinancialPeriod | null>(null);
  const [preview, setPreview] = useState<ClosePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [step, setStep] = useState(0);
  const [note, setNote] = useState('');
  const [typed, setTyped] = useState('');
  const [closing, setClosing] = useState(false);

  const [reopenFor, setReopenFor] = useState<FinancialPeriod | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [reopening, setReopening] = useState(false);

  const [viewFor, setViewFor] = useState<FinancialPeriod | null>(null);
  const [deleteFor, setDeleteFor] = useState<FinancialPeriod | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setPeriods(await periodService.list());
    } catch (err: any) {
      setError(getFriendlyError(err, "We couldn't load your financial years. Please try again."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setCreateForm(suggestNext(periods));
    setCreateOpen(true);
  };

  const create = async () => {
    if (!createForm.name.trim() || !createForm.startDate || !createForm.endDate) {
      toast.error('Add a name and both dates to continue');
      return;
    }
    try {
      setCreating(true);
      await periodService.create(createForm);
      toast.success(`${createForm.name} created`);
      setCreateOpen(false);
      load();
    } catch (err: any) {
      toast.error(getFriendlyError(err, "We couldn't create this financial year. Try again in a moment."));
    } finally {
      setCreating(false);
    }
  };

  const openWizard = async (period: FinancialPeriod) => {
    setWizardFor(period);
    setPreview(null);
    setStep(0);
    setNote('');
    setTyped('');
    try {
      setPreviewLoading(true);
      setPreview(await periodService.closePreview(period.id));
    } catch (err: any) {
      toast.error(getFriendlyError(err, "We couldn't prepare the year-end summary. Try again in a moment."));
      setWizardFor(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const closeYear = async () => {
    if (!wizardFor || !preview) return;
    try {
      setClosing(true);
      const res = await periodService.close(wizardFor.id, { confirmation: typed.trim(), note: note.trim() || undefined });
      toast.success(res.message || `${wizardFor.name} is closed`);
      setWizardFor(null);
      load();
    } catch (err: any) {
      toast.error(getFriendlyError(err, "We couldn't close this year. Try again in a moment."));
    } finally {
      setClosing(false);
    }
  };

  const reopen = async () => {
    if (!reopenFor) return;
    if (reopenReason.trim().length < 5) {
      toast.error('Explain why you are reopening it. This is kept in the audit trail.');
      return;
    }
    try {
      setReopening(true);
      const res = await periodService.reopen(reopenFor.id, reopenReason.trim());
      toast.success(res.message || `${reopenFor.name} is open again`);
      setReopenFor(null);
      setReopenReason('');
      load();
    } catch (err: any) {
      toast.error(getFriendlyError(err, "We couldn't reopen this year. Try again in a moment."));
    } finally {
      setReopening(false);
    }
  };

  const remove = async () => {
    if (!deleteFor) return;
    try {
      setDeleting(true);
      await periodService.remove(deleteFor.id);
      toast.success('Financial year deleted');
      setDeleteFor(null);
      load();
    } catch (err: any) {
      toast.error(getFriendlyError(err, "We couldn't delete this year. Try again in a moment."));
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn<FinancialPeriod>[] = [
    { key: 'name', label: 'Financial year', render: (v) => <span className="font-semibold">{v}</span> },
    { key: 'startDate', label: 'Dates', render: (_v, r) => `${fmtDate(r.startDate)} to ${fmtDate(r.endDate)}` },
    {
      key: 'status',
      label: 'Status',
      render: (v) => (
        <StatusBadge status={v} label={v === 'closed' ? 'Closed and locked' : 'Open'} tone={v === 'closed' ? 'neutral' : 'success'} />
      ),
    },
    { key: 'totals', label: 'Income', align: 'right', render: (_v, r) => (r.totals ? <span className="font-semibold text-[#0B4837] dark:text-brand-lime">{formatINR(r.totals.income)}</span> : '-') },
    { key: 'expense', label: 'Expense', align: 'right', render: (_v, r) => (r.totals ? <span className="font-semibold text-[#B3261E] dark:text-red-300">{formatINR(r.totals.expense)}</span> : '-') },
    { key: 'closedAt', label: 'Closed', render: (_v, r) => (r.closedAt ? `${fmtDate(r.closedAt)}${typeof r.closedBy === 'object' && r.closedBy ? ` by ${r.closedBy.name}` : ''}` : '-') },
    {
      key: 'actions',
      label: '',
      hideable: false,
      render: (_v, r) => (
        <RowActions
          onView={r.status === 'closed' ? () => setViewFor(r) : undefined}
          viewLabel="View summary"
          extra={[
            { label: 'Close year', icon: <FiLock />, onClick: () => openWizard(r), show: r.status === 'open' },
            { label: 'Reopen', icon: <FiUnlock />, onClick: () => { setReopenReason(''); setReopenFor(r); }, show: r.status === 'closed' && canReopen },
          ]}
          onDelete={r.status === 'open' ? () => setDeleteFor(r) : undefined}
          deleteLabel="Delete"
        />
      ),
    },
  ];

  const steps = [
    { id: 'check', label: 'Checklist' },
    { id: 'summary', label: 'Year summary' },
    { id: 'confirm', label: 'Confirm' },
  ];
  const confirmText = preview?.confirmationText ?? '';
  const canProceed = step === 0 ? !!preview?.canClose : true;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Financial years"
        description="Close a year to lock its entries and keep a snapshot for the general body"
        actions={<Button onClick={openCreate}>+ New financial year</Button>}
      />

      <Alert tone="info" title="How locking works">
        Once a year is closed, nobody can add, change or delete money entries dated inside it. To fix a mistake, post the
        correction in the current year, or ask a finance admin to reopen the year.
      </Alert>

      <Card padding="none">
        <div className="p-3.5">
          {loading ? (
            <div className="flex items-center justify-center py-12"><LoadingSpinner /></div>
          ) : error ? (
            <div className="py-12 text-center">
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <Button onClick={load} className="mt-4" variant="secondary">Retry</Button>
            </div>
          ) : periods.length === 0 ? (
            <EmptyState
              title="No financial years yet"
              description="Create your first financial year, for example April to March. Until then every date stays open for editing."
              action={{ label: '+ New financial year', onClick: openCreate }}
            />
          ) : (
            <div className="overflow-x-auto">
              <Table columns={columns} data={periods} showExport={false} />
            </div>
          )}
        </div>
      </Card>

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="New financial year" size="md">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input label="Name" value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="FY 2026-27" required />
          </div>
          <Input label="Starts on" type="date" value={createForm.startDate} onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })} required />
          <Input label="Ends on" type="date" value={createForm.endDate} onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })} required />
        </div>
        <p className="mt-2 text-xs text-[#7B8983] dark:text-surface-muted">Years cannot overlap. The end date is included in the year.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={creating}>Cancel</Button>
          <Button onClick={create} disabled={creating}>{creating ? 'Creating...' : 'Create year'}</Button>
        </div>
      </Modal>

      <Modal
        isOpen={!!wizardFor}
        onClose={() => !closing && setWizardFor(null)}
        title={wizardFor ? `Close ${wizardFor.name}` : ''}
        description={wizardFor ? `${fmtDate(wizardFor.startDate)} to ${fmtDate(wizardFor.endDate)}` : undefined}
        size="lg"
      >
        <Stepper steps={steps} current={step} maxVisited={step} onStepClick={setStep} className="mb-4" />
        {previewLoading || !preview ? (
          <div className="flex items-center justify-center py-10"><LoadingSpinner /></div>
        ) : (
          <>
            {step === 0 && (
              <div className="space-y-2">
                {preview.checklist.map((c) => (
                  <div key={c.key} className="flex items-start gap-2.5 rounded-xl border border-line p-3 dark:border-surface-border">
                    {c.ok ? (
                      <FiCheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#1E9B63]" aria-hidden="true" />
                    ) : (
                      <FiAlertTriangle className={`mt-0.5 h-4 w-4 flex-shrink-0 ${c.blocking ? 'text-[#B3261E]' : 'text-[#E0B400]'}`} aria-hidden="true" />
                    )}
                    <div>
                      <p className="text-[13px] font-semibold text-[#18231E] dark:text-surface-text">{c.label}</p>
                      <p className="text-xs text-[#5B6963] dark:text-surface-muted">{c.detail}</p>
                    </div>
                  </div>
                ))}
                {!preview.canClose && (
                  <Alert tone="warning">Resolve the items marked above, then open this again. Closing is blocked until they are done.</Alert>
                )}
              </div>
            )}

            {step === 1 && (
              <Snapshot totals={preview.totals} ledgerTotals={preview.ledgerTotals} balances={preview.openingBalances} note={preview.balancesNote} />
            )}

            {step === 2 && (
              <div className="space-y-3">
                <Alert tone="warning" title="This locks the whole year">
                  Entries dated {fmtDate(preview.period.startDate)} to {fmtDate(preview.period.endDate)} cannot be added, edited or deleted after you close it.
                </Alert>
                <Input label="Closing note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: approved at the general body on 12 April" />
                <Input
                  label={`Type "${confirmText}" to confirm`}
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  autoComplete="off"
                />
              </div>
            )}

            <div className="mt-5 flex justify-between gap-2">
              <Button variant="secondary" onClick={() => (step === 0 ? setWizardFor(null) : setStep(step - 1))} disabled={closing}>
                {step === 0 ? 'Cancel' : 'Back'}
              </Button>
              {step < 2 ? (
                <Button onClick={() => setStep(step + 1)} disabled={!canProceed}>Continue</Button>
              ) : (
                <Button variant="danger-solid" onClick={closeYear} disabled={closing || typed.trim() !== confirmText}>
                  {closing ? 'Closing...' : 'Close year'}
                </Button>
              )}
            </div>
          </>
        )}
      </Modal>

      <Modal isOpen={!!reopenFor} onClose={() => !reopening && setReopenFor(null)} title={reopenFor ? `Reopen ${reopenFor.name}` : ''} size="sm">
        <p className="text-[13px] text-[#3A4741] dark:text-surface-text">
          Entries in this year can be changed again until you close it. Your name and reason are saved in the audit trail.
        </p>
        <div className="mt-3">
          <Input label="Reason" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="For example: missed bank charge for March" required />
        </div>
        <div className="mt-5 flex justify-end gap-2.5">
          <Button variant="secondary" onClick={() => setReopenFor(null)} disabled={reopening}>Keep it closed</Button>
          <Button onClick={reopen} disabled={reopening}>{reopening ? 'Reopening...' : 'Reopen year'}</Button>
        </div>
      </Modal>

      <Modal isOpen={!!viewFor} onClose={() => setViewFor(null)} title={viewFor ? `${viewFor.name} summary` : ''} description={viewFor?.closingNote} size="lg">
        {viewFor && (
          <div className="space-y-4">
            <Snapshot totals={viewFor.totals} ledgerTotals={viewFor.ledgerTotals as any} balances={viewFor.openingBalances} note={viewFor.balancesAsOf ? `Balances as at ${fmtDate(viewFor.balancesAsOf)}.` : undefined} />
            {!!viewFor.history?.length && (
              <div>
                <p className="mb-1 text-xs font-bold text-[#18231E] dark:text-surface-text">History</p>
                <ul className="space-y-1 text-xs text-[#5B6963] dark:text-surface-muted">
                  {viewFor.history.map((h, i) => (
                    <li key={i}>
                      {fmtDate(h.at)}: {h.action}{h.byName ? ` by ${h.byName}` : ''}{h.note ? ` - ${h.note}` : ''}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteFor}
        title="Delete this financial year?"
        message={deleteFor ? `${deleteFor.name} will be removed. No entries are deleted.` : ''}
        confirmLabel="Delete year"
        isLoading={deleting}
        onConfirm={remove}
        onCancel={() => setDeleteFor(null)}
      />
    </div>
  );
}
