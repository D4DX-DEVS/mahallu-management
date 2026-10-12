import { useEffect, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { registrationService, SideEffectsPreview } from '@/services/registrationService';

/**
 * Loads "what will approving this change" from the API (debounced).
 * `payload` must be memoised or primitive-stable; it is compared by JSON.
 */
export function useSideEffectsPreview(kind: 'death' | 'nikah', payload: Record<string, any>, enabled: boolean) {
  const [preview, setPreview] = useState<SideEffectsPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const key = JSON.stringify(payload);

  useEffect(() => {
    if (!enabled) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      const call = kind === 'death' ? registrationService.previewDeath : registrationService.previewNikah;
      call(JSON.parse(key))
        .then((p) => !cancelled && setPreview(p))
        .catch(() => !cancelled && setPreview(null))
        .finally(() => !cancelled && setLoading(false));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [kind, key, enabled]);

  return { preview, loading };
}

export interface SideEffectsSummaryProps {
  preview: SideEffectsPreview | null;
  loading?: boolean;
  /** Heading, e.g. "Saving as approved will:" */
  title?: string;
  onPickGrave?: (graveId: string) => void;
  onPickSpouse?: (memberId: string) => void;
  pickedGraveId?: string;
  pickedSpouseId?: string;
}

/** Plain-language list of what an approval changes, plus warnings and optional suggestions. */
export default function SideEffectsSummary({ preview, loading, title = 'Approving this will:', onPickGrave, onPickSpouse, pickedGraveId, pickedSpouseId }: SideEffectsSummaryProps) {
  if (loading && !preview) return <p className="text-xs text-[#7B8983] dark:text-surface-muted">Checking what this will change...</p>;
  if (!preview) return null;
  const { effects, warnings, suggestions } = preview;
  return (
    <div className="space-y-2.5" aria-live="polite">
      {effects.length > 0 && (
        <Alert tone="info" title={title}>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {effects.map((e, i) => (
              <li key={i}>{e.message}</li>
            ))}
          </ul>
          <p className="mt-1.5 text-[12px] opacity-80">Rejecting or deleting the registration later undoes these changes.</p>
        </Alert>
      )}
      {warnings.map((w, i) => (
        <Alert key={i} tone="warning">{w}</Alert>
      ))}
      {suggestions?.spouseCandidates && suggestions.spouseCandidates.length > 0 && onPickSpouse && (
        <div className="rounded-xl border border-line p-3 dark:border-surface-border">
          <p className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Who was the spouse? (optional)</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {suggestions.spouseCandidates.map((c) => (
              <Button key={c.id} size="sm" variant={pickedSpouseId === c.id ? 'primary' : 'secondary'} type="button" onClick={() => onPickSpouse(pickedSpouseId === c.id ? '' : c.id)}>
                {c.name}
              </Button>
            ))}
          </div>
        </div>
      )}
      {suggestions?.graves && suggestions.graves.length > 0 && onPickGrave && (
        <div className="rounded-xl border border-line p-3 dark:border-surface-border">
          <p className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Link a grave record? (optional)</p>
          <p className="text-xs text-[#5B6963] dark:text-surface-muted">We found a record that looks like this person.</p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {suggestions.graves.map((g) => (
              <Button key={g.id} size="sm" variant={pickedGraveId === g.id ? 'primary' : 'secondary'} type="button" onClick={() => onPickGrave(pickedGraveId === g.id ? '' : g.id)}>
                Grave {g.graveNo}{g.cemetery ? `, ${g.cemetery}` : ''}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Final "are you sure" before an approval that changes member records. */
export function ApprovalConfirmDialog({
  open,
  preview,
  isSaving,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  preview: SideEffectsPreview | null;
  isSaving?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      isOpen={open}
      onClose={onCancel}
      size="md"
      title="Approve and update member records?"
      footer={
        <div className="flex justify-end gap-2.5">
          <Button variant="secondary" onClick={onCancel} disabled={isSaving}>Go back</Button>
          <Button onClick={onConfirm} isLoading={isSaving}>Approve</Button>
        </div>
      }
    >
      <SideEffectsSummary preview={preview} title="This will:" />
    </Modal>
  );
}
