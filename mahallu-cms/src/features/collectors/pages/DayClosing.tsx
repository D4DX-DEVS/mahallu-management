import { useCallback, useEffect, useMemo, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import AmountInput from '@/components/ui/AmountInput';
import StatusBadge from '@/components/ui/StatusBadge';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import { FiCheck, FiRotateCcw } from 'react-icons/fi';
import StatCard from '@/components/ui/StatCard';
import Alert from '@/components/ui/Alert';
import Modal from '@/components/ui/Modal';
import HijriDate from '@/components/HijriDate';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { useAuthStore } from '@/store/authStore';
import { hasFlag } from '@/utils/permissions';
import formatINR from '@/utils/formatINR';
import {
  cashClosingService, collectorService, Collector, ExpectedCash, CashClosing, DENOMINATIONS,
} from '@/services/collectorService';

const todayKey = () => new Date(Date.now() + 330 * 60000).toISOString().slice(0, 10); // IST day, like the server
const idOf = (v: any) => (typeof v === 'string' ? v : v?.id);
const nameOf = (v: any) => (typeof v === 'string' ? '' : v?.name || '');

export default function DayClosing() {
  const user = useAuthStore((s) => s.user);
  const canClose = hasFlag(user, 'canCloseCashDay');
  const canVerify = hasFlag(user, 'canVerifyCashDay');

  const [date, setDate] = useState(todayKey());
  const [collectorId, setCollectorId] = useState('');
  const [collectors, setCollectors] = useState<Collector[]>([]);
  const [preview, setPreview] = useState<ExpectedCash | null>(null);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [manual, setManual] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<CashClosing[]>([]);
  const [reopenTarget, setReopenTarget] = useState<CashClosing | null>(null);
  const [reopenReason, setReopenReason] = useState('');

  const loadHistory = useCallback(() => {
    cashClosingService.list({ limit: 15 }).then((r) => setHistory(r.data)).catch(() => undefined);
  }, []);
  const loadPreview = useCallback(() => {
    cashClosingService.preview({ date, collectorId: collectorId || undefined }).then(setPreview).catch((e) => setError(getFriendlyError(e, "Couldn't load the expected cash. Refresh the page or try again.")));
  }, [date, collectorId]);

  useEffect(() => { collectorService.list({ active: true }).then(setCollectors).catch(() => undefined); loadHistory(); }, [loadHistory]);
  useEffect(() => { setError(''); loadPreview(); }, [loadPreview]);

  const counted = useMemo(() => {
    const fromNotes = DENOMINATIONS.reduce((a, d) => a + d * (parseInt(counts[String(d)] || '0', 10) || 0), 0);
    return manual !== '' ? Number(manual) : fromNotes;
  }, [counts, manual]);
  const notesTotal = DENOMINATIONS.reduce((a, d) => a + d * (parseInt(counts[String(d)] || '0', 10) || 0), 0);
  const expected = preview?.expectedCash ?? 0;
  const diff = Math.round((counted - expected) * 100) / 100;
  const existing = preview?.existing;
  const locked = !!existing && existing.status !== 'reopened';
  const tone = diff === 0 ? 'text-primary-700 dark:text-brand-lime' : diff < 0 ? 'text-[#B3261E] dark:text-red-300' : 'text-[#7A5B00] dark:text-secondary-300';

  const submit = async () => {
    setError('');
    if (diff !== 0 && !note.trim()) return setError(`The count is ${diff < 0 ? 'short' : 'over'} by ${formatINR(Math.abs(diff))}. Add a note to explain.`);
    const denominations = Object.fromEntries(Object.entries(counts).filter(([, v]) => parseInt(v, 10) > 0).map(([k, v]) => [k, parseInt(v, 10)]));
    if (manual !== '' && Object.keys(denominations).length && notesTotal !== Number(manual)) return setError(`The notes and coins add up to ${formatINR(notesTotal)}, not ${formatINR(Number(manual))}. Clear one of them.`);
    try {
      setSaving(true);
      await cashClosingService.submit({ date, collectorId: collectorId || undefined, countedCash: counted, denominations: Object.keys(denominations).length ? denominations : undefined, note: note.trim() });
      toast.success('Day closing submitted. Another admin needs to verify it.');
      setCounts({}); setManual(''); setNote('');
      loadPreview(); loadHistory();
    } catch (e: any) { toast.error(getFriendlyError(e, "Couldn't submit the closing. Try again in a moment.")); }
    finally { setSaving(false); }
  };

  const verify = async (c: CashClosing) => {
    try { await cashClosingService.verify(c.id); toast.success('Closing verified'); loadHistory(); loadPreview(); }
    catch (e: any) { toast.error(getFriendlyError(e, "Couldn't verify. Try again in a moment.")); }
  };
  const reopen = async () => {
    if (!reopenTarget) return;
    if (!reopenReason.trim()) return toast.error('Add a reason to continue');
    try { await cashClosingService.reopen(reopenTarget.id, reopenReason.trim()); setReopenTarget(null); setReopenReason(''); loadHistory(); loadPreview(); }
    catch (e: any) { toast.error(getFriendlyError(e, "Couldn't reopen. Try again in a moment.")); }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Day closing" description="Count the cash, compare it with the receipts, and hand it over for verification" />

      <Card padding="lg">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <Input label="Day" type="date" max={todayKey()} value={date} onChange={(e) => setDate(e.target.value || todayKey())} />
            <p className="mt-1 text-[12px] text-[#7B8983]"><HijriDate date={date} /></p>
          </div>
          <div>
            <label className={labelClasses}>Whose cash</label>
            <select className={`${controlClasses} h-9`} value={collectorId} onChange={(e) => setCollectorId(e.target.value)}>
              <option value="">Whole mahallu</option>
              {collectors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex items-end">{existing && <StatusBadge status={existing.status} />}</div>
        </div>
      </Card>

      {preview?.note && <Alert tone="info">{preview.note}</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      {existing?.status === 'reopened' && <Alert tone="warning" title="Reopened">{existing.reopenReason}. Count again and submit.</Alert>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard variant="tile" title="Expected cash" value={formatINR(expected)} pills={[`${preview?.breakdown.receiptCount ?? 0} cash receipts`]} />
        <StatCard variant="tile" title="Counted cash" value={formatINR(counted)} />
        <Card padding="none" className="px-3.5 py-3">
          <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Difference</p>
          <p className={`mt-1 text-[22px] font-extrabold ${tone}`} aria-live="polite">
            {diff === 0 ? 'Matches' : `${diff < 0 ? 'Short' : 'Over'} ${formatINR(Math.abs(diff))}`}
          </p>
        </Card>
      </div>

      {preview && (
        <p className="text-xs text-[#7B8983] dark:text-surface-muted">
          Expected = varisangya {formatINR(preview.breakdown.varisangya)} + zakat {formatINR(preview.breakdown.zakat)} + campaigns {formatINR(preview.breakdown.campaigns)}. Only approved cash receipts count; UPI, bank and cancelled receipts do not.
        </p>
      )}

      {!locked ? (
        <Card padding="lg">
          <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Count the cash</h2>
          <p className="text-xs text-[#7B8983]">Enter how many of each note or coin you have. The total fills in by itself.</p>
          <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
            {DENOMINATIONS.map((d) => (
              <div key={d}>
                <label className={labelClasses} htmlFor={`den-${d}`}>Rs {d}</label>
                <input id={`den-${d}`} inputMode="numeric" className={`${controlClasses} h-9 text-right`} value={counts[String(d)] || ''}
                  onChange={(e) => setCounts({ ...counts, [String(d)]: e.target.value.replace(/\D/g, '') })} />
                <p className="mt-0.5 text-right text-[12px] text-[#98A59F]">{formatINR(d * (parseInt(counts[String(d)] || '0', 10) || 0))}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AmountInput label="Or type the total directly" value={manual} onChange={(e) => setManual(e.target.value)} helperText={`Notes and coins total ${formatINR(notesTotal)}`} />
            <div>
              <label className={labelClasses}>Note {diff !== 0 && <span className="text-red-500">*</span>}</label>
              <textarea rows={2} className={`${controlClasses} py-2`} value={note} onChange={(e) => setNote(e.target.value)} placeholder={diff !== 0 ? 'Why is the count different?' : 'Optional'} />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={submit} isLoading={saving} disabled={!canClose}>Submit closing</Button>
          </div>
          {!canClose && <p className="mt-2 text-xs text-[#B3261E]">You do not have permission to close the day. Ask your mahallu admin.</p>}
        </Card>
      ) : (
        <Alert tone="success" title={`This day is ${existing?.status}`}>
          Counted {formatINR(existing!.countedCash)} against {formatINR(existing!.expectedCash)}. {existing!.status === 'submitted' ? 'Waiting for another admin to verify it.' : ''}
        </Alert>
      )}

      <div>
        <h2 className="mb-2 text-sm font-bold text-[#18231E] dark:text-surface-text">Recent closings</h2>
        <Table<CashClosing>
          data={history}
          exportFilename="day-closings"
          emptyMessage="No days closed yet"
          columns={[
            { key: 'dateKey', label: 'Day', render: (v) => new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) },
            { key: 'collectorId', label: 'Whose cash', render: (v) => (nameOf(v) ? <PersonCell name={nameOf(v)} /> : 'Whole mahallu') },
            { key: 'expectedCash', label: 'Expected', align: 'right', render: (v) => formatINR(v) },
            { key: 'countedCash', label: 'Counted', align: 'right', render: (v) => formatINR(v) },
            { key: 'difference', label: 'Difference', align: 'right', render: (v) => <span className={v === 0 ? '' : v < 0 ? 'font-bold text-[#B3261E]' : 'font-bold text-[#7A5B00]'}>{v === 0 ? '0' : `${v < 0 ? '-' : '+'}${formatINR(Math.abs(v))}`}</span> },
            { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
            { key: 'actions', label: '', hideable: false, render: (_v, r) => (
              <RowActions
                extra={[
                  { label: 'Verify', icon: <FiCheck />, onClick: () => verify(r), show: r.status === 'submitted' && canVerify, disabledReason: idOf(r.submittedBy) === user?.id ? 'Another admin must verify' : undefined },
                  { label: 'Reopen', icon: <FiRotateCcw />, onClick: () => setReopenTarget(r), show: r.status !== 'reopened' && canVerify },
                ]}
              />) },
          ]}
        />
      </div>

      <Modal isOpen={!!reopenTarget} onClose={() => setReopenTarget(null)} title="Reopen this day?" description="The submitter will have to count and submit again."
        footer={<><Button variant="secondary" onClick={() => setReopenTarget(null)}>Keep as is</Button><Button onClick={reopen}>Reopen</Button></>}>
        <Input label="Reason" required value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} />
      </Modal>
    </div>
  );
}
