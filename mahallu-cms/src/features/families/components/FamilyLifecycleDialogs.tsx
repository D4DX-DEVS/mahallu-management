import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Checkbox from '@/components/ui/Checkbox';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import SearchableSelect, { SearchableSelectOption } from '@/components/ui/SearchableSelect';
import { familyService, FamilyLifecycleInfo, MergePreview } from '@/services/familyService';
import { memberService } from '@/services/memberService';
import type { Member } from '@/types';
import { getFriendlyError } from '@/utils/apiMessages';

const REFERENCE_LABELS: Record<string, string> = {
  Varisangya: 'varisangya payments',
  Zakat: 'zakat records',
  ZakatBeneficiary: 'zakat beneficiary entries',
  ZakatDistribution: 'zakat distributions',
  WelfareApplication: 'welfare applications',
  ReliefCase: 'relief cases',
  QardLoan: 'qard loans',
  MarriageAssistance: 'marriage assistance cases',
  ClusterVisit: 'cluster visits',
  GraveRecord: 'grave records',
  DeathRegistration: 'death registrations',
  Wallet: 'wallets',
};

const money = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const errorText = (err: any, fallback: string) => getFriendlyError(err, fallback);

/** Debounced family search used by the merge and transfer dialogs. */
function FamilyPicker({
  label,
  value,
  onChange,
  excludeId,
  hint,
  pinned,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  excludeId?: string;
  hint?: string;
  /** An option that must always be selectable (e.g. a pre-chosen merge target). */
  pinned?: SearchableSelectOption;
}) {
  const [options, setOptions] = useState<SearchableSelectOption[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const res = await familyService.getAll({ search: q || undefined, limit: 30 });
        const found: SearchableSelectOption[] = res.data
          .filter((f: any) => f.id !== excludeId)
          .map((f: any) => ({
            value: f.id,
            label: f.houseName,
            sublabel: [f.mahallId, f.familyHead ? `Head: ${f.familyHead}` : undefined, f.area].filter(Boolean).join(' · '),
          }));
        setOptions(pinned && !found.some((o) => o.value === pinned.value) ? [pinned, ...found] : found);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [excludeId, pinned]
  );

  useEffect(() => {
    search('');
  }, [search]);

  return (
    <SearchableSelect
      label={label}
      placeholder="Type a house name, family ID or phone..."
      options={options}
      value={value}
      onChange={onChange}
      onSearch={search}
      isLoading={loading}
      helperText={hint}
    />
  );
}

interface BaseProps {
  open: boolean;
  onClose: () => void;
  /** Called after the change succeeded so the page can reload. */
  onDone: (message?: string) => void;
}

/* ------------------------------------------------------------------ Archive */

export function ArchiveFamilyDialog({ open, familyId, houseName, onClose, onDone }: BaseProps & { familyId: string; houseName: string }) {
  const [info, setInfo] = useState<FamilyLifecycleInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [cascade, setCascade] = useState(false);
  const [force, setForce] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCascade(false);
    setForce(false);
    setReason('');
    setError(null);
    setLoading(true);
    familyService
      .getLifecycle(familyId)
      .then(setInfo)
      .catch((e) => setError(errorText(e, 'We could not check this family. Please try again.')))
      .finally(() => setLoading(false));
  }, [open, familyId]);

  const needsCascade = (info?.activeMembers || 0) > 0;
  const hasDues = (info?.dueAmount || 0) > 0;
  const ready = !!info && (!needsCascade || cascade) && (!hasDues || force);

  const submit = async () => {
    try {
      setSaving(true);
      setError(null);
      await familyService.archive(familyId, { cascade, force, reason: reason.trim() || undefined });
      onDone('Family archived. You can restore it any time.');
    } catch (e: any) {
      setError(errorText(e, 'We could not archive this family. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="md"
      title={`Archive ${houseName}?`}
      description="This family will be hidden from lists and reports. You can restore it later."
      footer={
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Keep family</Button>
          <Button variant="danger-solid" onClick={submit} isLoading={saving} disabled={!ready}>Archive family</Button>
        </div>
      }
    >
      {loading && <div className="flex justify-center py-6"><LoadingSpinner /></div>}
      {error && <Alert tone="danger" className="mb-3">{error}</Alert>}
      {info && (
        <div className="space-y-3">
          <ul className="list-disc space-y-1 pl-5 text-[13px] text-[#3A4741] dark:text-surface-text">
            <li>The family disappears from the family list, dashboards and reminders.</li>
            <li>Payments, receipts and records stay exactly as they are.</li>
            <li>Restoring brings the family{needsCascade ? ' and the members archived with it' : ''} back.</li>
          </ul>

          {needsCascade && (
            <div className="rounded-xl border border-line p-3 dark:border-surface-border">
              <p className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">
                {info.activeMembers} active member{info.activeMembers === 1 ? '' : 's'}
              </p>
              <p className="mt-0.5 text-xs text-[#5B6963] dark:text-surface-muted">
                {info.members.slice(0, 8).map((m) => m.name).join(', ')}
                {info.members.length > 8 ? ` and ${info.members.length - 8} more` : ''}
              </p>
              <div className="mt-2">
                <Checkbox label="Archive these members together with the family" checked={cascade} onChange={(e) => setCascade(e.target.checked)} />
              </div>
            </div>
          )}

          {hasDues && (
            <Alert tone="warning" title={`Unpaid dues: ${money(info.dueAmount)}`}>
              This family still owes varisangya. Archiving stops reminders, so only continue if the dues are settled or written off.
              <div className="mt-2">
                <Checkbox label="Archive anyway" checked={force} onChange={(e) => setForce(e.target.checked)} />
              </div>
            </Alert>
          )}

          <Input label="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Family moved to another city" />
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ Merge */

export function MergeFamilyDialog({
  open,
  familyId,
  houseName,
  initialTarget,
  onClose,
  onDone,
}: BaseProps & { familyId: string; houseName: string; initialTarget?: { id: string; label: string; sublabel?: string } }) {
  const [targetId, setTargetId] = useState('');
  const pinned = useMemo(() => (initialTarget ? { value: initialTarget.id, label: initialTarget.label, sublabel: initialTarget.sublabel } : undefined), [initialTarget?.id, initialTarget?.label, initialTarget?.sublabel]); // eslint-disable-line react-hooks/exhaustive-deps
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTargetId(initialTarget?.id || '');
      setPreview(null);
      setError(null);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!targetId) {
      setPreview(null);
      return;
    }
    setLoading(true);
    setError(null);
    familyService
      .mergePreview(familyId, targetId)
      .then(setPreview)
      .catch((e) => {
        setPreview(null);
        setError(errorText(e, 'We could not prepare this merge.'));
      })
      .finally(() => setLoading(false));
  }, [targetId, familyId]);

  const submit = async () => {
    try {
      setSaving(true);
      setError(null);
      const r = await familyService.merge(familyId, targetId);
      onDone(`Merged. ${r.movedMembers} member${r.movedMembers === 1 ? '' : 's'} moved.`);
    } catch (e: any) {
      setError(errorText(e, 'We could not merge these families. Nothing was changed.'));
    } finally {
      setSaving(false);
    }
  };

  const refs = preview ? Object.entries(preview.references) : [];

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="lg"
      title={`Merge ${houseName} into another family`}
      description="Use this when the same household was entered twice, or two households became one."
      footer={
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} isLoading={saving} disabled={!preview}>
            Merge families
          </Button>
        </div>
      }
    >
      {error && <Alert tone="danger" className="mb-3">{error}</Alert>}
      <FamilyPicker label="Merge into" value={targetId} onChange={setTargetId} excludeId={familyId} pinned={pinned} hint="The family you pick keeps its name and ID." />
      {loading && <div className="flex justify-center py-6"><LoadingSpinner /></div>}
      {preview && (
        <div className="mt-4 space-y-3">
          <h3 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">What will happen</h3>
          <ul className="list-disc space-y-1 pl-5 text-[13px] text-[#3A4741] dark:text-surface-text">
            <li>
              {preview.members.length} member{preview.members.length === 1 ? '' : 's'} move from <b>{preview.source.houseName}</b> to <b>{preview.target.houseName}</b> and get new member IDs.
            </li>
            {refs.length > 0 && (
              <li>
                {refs.map(([k, n]) => `${n} ${REFERENCE_LABELS[k] || k}`).join(', ')} follow the family.
              </li>
            )}
            <li>
              {preview.headOutcome.keep
                ? `${preview.headOutcome.keep} stays as family head${preview.headOutcome.demoted.length ? `; ${preview.headOutcome.demoted.join(', ')} will no longer be head` : ''}.`
                : preview.headOutcome.note || 'The merged family will need a head.'}
            </li>
            <li><b>{preview.source.houseName}</b> is archived and an audit entry is saved on both families.</li>
          </ul>
          <div className="flex flex-wrap gap-1.5" aria-label="Members moving">
            {preview.members.map((m) => (
              <Badge key={m.id} variant={m.isDead ? 'neutral' : 'primary'} size="sm">
                {m.name}{m.isFamilyHead ? ' (head)' : ''}{m.isDead ? ' (deceased)' : ''}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ Split */

export function SplitFamilyDialog({ open, familyId, houseName, onClose, onDone }: BaseProps & { familyId: string; houseName: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const [newHouseName, setNewHouseName] = useState('');
  const [headId, setHeadId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setPicked([]);
    setNewHouseName('');
    setHeadId('');
    setError(null);
    setLoading(true);
    memberService
      .getByFamily(familyId)
      .then((rows) => setMembers(rows.filter((m: any) => m.status !== 'deleted')))
      .catch((e) => setError(errorText(e, 'We could not load the members.')))
      .finally(() => setLoading(false));
  }, [open, familyId]);

  const toggle = (id: string) => {
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
    if (headId === id) setHeadId('');
  };

  const staying = members.length - picked.length;
  const movingMembers = members.filter((m) => picked.includes(m.id));
  const headMoves = movingMembers.some((m: any) => m.isFamilyHead);
  const canSubmit = picked.length > 0 && staying > 0 && newHouseName.trim().length > 0;

  const headOptions = useMemo(
    () => [
      { value: '', label: 'Choose later' },
      ...movingMembers.filter((m: any) => m.status === 'active' && !m.isDead).map((m) => ({ value: m.id, label: m.name })),
    ],
    [movingMembers]
  );

  const submit = async () => {
    try {
      setSaving(true);
      setError(null);
      const r = await familyService.split(familyId, { memberIds: picked, newHouseName: newHouseName.trim(), newFamilyHeadId: headId || undefined });
      onDone(`New family "${r.newFamily.houseName}" created with ${r.movedMembers} member${r.movedMembers === 1 ? '' : 's'}.`);
    } catch (e: any) {
      setError(errorText(e, 'We could not split this family. Nothing was changed.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="lg"
      title={`Split ${houseName}`}
      description="Move some members into a new family, for example after a marriage or when a household separates."
      footer={
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} isLoading={saving} disabled={!canSubmit}>Create new family</Button>
        </div>
      }
    >
      {error && <Alert tone="danger" className="mb-3">{error}</Alert>}
      {loading ? (
        <div className="flex justify-center py-6"><LoadingSpinner /></div>
      ) : (
        <div className="space-y-4">
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-bold text-[#18231E] dark:text-surface-text">Who moves to the new family?</legend>
            <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-line p-2.5 dark:border-surface-border">
              {members.length === 0 && <p className="text-xs text-[#7B8983]">This family has no members.</p>}
              {members.map((m: any) => (
                <Checkbox
                  key={m.id}
                  checked={picked.includes(m.id)}
                  onChange={() => toggle(m.id)}
                  label={`${m.name}${m.isFamilyHead ? ' (head)' : ''}${m.isDead ? ' (deceased)' : ''}${m.age ? `, ${m.age}` : ''}`}
                />
              ))}
            </div>
            <p className="mt-1 text-xs text-[#5B6963] dark:text-surface-muted">
              {picked.length} moving, {Math.max(staying, 0)} staying{staying <= 0 && picked.length > 0 ? ' (at least one member must stay; use Merge to move everyone)' : ''}
            </p>
          </fieldset>

          <Input label="New family house name" value={newHouseName} onChange={(e) => setNewHouseName(e.target.value)} placeholder="e.g. Madathil (new house)" required />
          <Select label="Head of the new family" value={headId} onChange={(e) => setHeadId(e.target.value)} options={headOptions} />
          {headMoves && (
            <Alert tone="warning">
              The current family head is moving. {houseName} will be flagged so you can choose a new head.
            </Alert>
          )}
          <p className="text-xs text-[#5B6963] dark:text-surface-muted">
            Past payments stay with {houseName}. The new family gets its own ID, and moved members get new member IDs.
          </p>
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ Transfer */

export function TransferMemberDialog({
  open,
  member,
  currentFamilyId,
  onClose,
  onDone,
}: BaseProps & { member: { id: string; name: string; isFamilyHead?: boolean }; currentFamilyId?: string }) {
  const [targetId, setTargetId] = useState('');
  const [makeHead, setMakeHead] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTargetId('');
      setMakeHead(false);
      setError(null);
    }
  }, [open]);

  const submit = async () => {
    try {
      setSaving(true);
      setError(null);
      const r = await memberService.transfer(member.id, targetId, makeHead);
      onDone(r.message);
    } catch (e: any) {
      setError(errorText(e, 'We could not move this member. Nothing was changed.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="md"
      title={`Move ${member.name} to another family`}
      description="Use this for a marriage or when someone moves house within the mahallu."
      footer={
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} isLoading={saving} disabled={!targetId}>Move member</Button>
        </div>
      }
    >
      {error && <Alert tone="danger" className="mb-3">{error}</Alert>}
      <div className="space-y-3">
        <FamilyPicker label="New family" value={targetId} onChange={setTargetId} excludeId={currentFamilyId} />
        <Checkbox label="Make them the head of the new family" checked={makeHead} onChange={(e) => setMakeHead(e.target.checked)} />
        {member.isFamilyHead && (
          <Alert tone="warning">
            {member.name} is the head of their current family. That family will be flagged so you can choose a new head.
          </Alert>
        )}
        <p className="text-xs text-[#5B6963] dark:text-surface-muted">
          They get a new member ID in the new family. Their own payments and records move with them.
        </p>
      </div>
    </Modal>
  );
}
