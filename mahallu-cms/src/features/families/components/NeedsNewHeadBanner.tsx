import { useEffect, useState } from 'react';
import { FiUserCheck } from 'react-icons/fi';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import { familyService } from '@/services/familyService';
import { memberService } from '@/services/memberService';
import type { Member } from '@/types';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

export interface NeedsNewHeadBannerProps {
  familyId: string;
  /** Only render when the family detail says the family needs a head. */
  needsHeadReassignment?: boolean;
  reason?: string;
  /** Called after a new head is saved so the page can refresh. */
  onResolved?: () => void;
}

/** "This family needs a new head" alert for the family detail page, with a one-step fix. */
export default function NeedsNewHeadBanner({ familyId, needsHeadReassignment, reason, onResolved }: NeedsNewHeadBannerProps) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [choice, setChoice] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    memberService
      .getByFamily(familyId)
      .then((rows) => setMembers(rows.filter((m: any) => m.status === 'active' && !m.isDead)))
      .catch(() => setError('We could not load the family members. Please try again.'));
  }, [open, familyId]);

  if (!needsHeadReassignment) return null;

  const save = async () => {
    if (!choice) return;
    try {
      setSaving(true);
      setError(null);
      await familyService.setHead(familyId, choice);
      setOpen(false);
      onResolved?.();
    } catch (err: any) {
      toast.error(getFriendlyError(err, "We couldn't change the family head. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Alert
        tone="warning"
        title="This family needs a new head"
        action={
          <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
            <FiUserCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Choose head
          </Button>
        }
      >
        {reason || 'The previous head is no longer active.'} Pick someone so dues, reminders and certificates reach the right person.
      </Alert>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        size="sm"
        title="Choose the new family head"
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={save} isLoading={saving} disabled={!choice}>Make head</Button>
          </div>
        }
      >
        {error && <Alert tone="danger" className="mb-3">{error}</Alert>}
        <Select
          label="Member"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          options={[{ value: '', label: members.length ? 'Select a member...' : 'No active members to choose' }, ...members.map((m) => ({ value: m.id, label: m.name }))]}
        />
      </Modal>
    </>
  );
}
