import { FiExternalLink } from 'react-icons/fi';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import { ROUTES } from '@/constants/routes';
import type { DuplicateMatchItem } from '@/services/familyService';

export interface DuplicateWarningProps {
  open: boolean;
  /** What is being created, used in the wording. */
  entity?: 'family' | 'member';
  matches: DuplicateMatchItem[];
  isSaving?: boolean;
  /** The admin has checked and wants to save anyway (re-sends with confirmDuplicate). */
  onCreateAnyway: () => void;
  /** Close and go back to the form. */
  onCancel: () => void;
}

/**
 * Shown when the API answers 409 POSSIBLE_DUPLICATE on a create or import.
 * "Open existing" opens the record in a new tab so the half-filled form is not lost.
 */
export default function DuplicateWarning({ open, entity = 'family', matches, isSaving, onCreateAnyway, onCancel }: DuplicateWarningProps) {
  const noun = entity === 'family' ? 'family' : 'member';
  const href = (m: DuplicateMatchItem) => (entity === 'family' ? ROUTES.FAMILIES.DETAIL(m.id) : ROUTES.MEMBERS.DETAIL(m.id));
  const linkable = (m: DuplicateMatchItem) => !!m.id && !String(m.id).startsWith('row-');

  return (
    <Modal
      isOpen={open}
      onClose={onCancel}
      size="md"
      title={`This looks like an existing ${noun}`}
      description="Please check before adding it again, so the same household does not appear twice."
      footer={
        <div className="flex flex-wrap justify-end gap-2.5">
          <Button variant="secondary" onClick={onCancel} disabled={isSaving}>
            Go back and edit
          </Button>
          <Button variant="primary" onClick={onCreateAnyway} isLoading={isSaving}>
            Create anyway
          </Button>
        </div>
      }
    >
      <Alert tone="warning" title={`We found ${matches.length} possible match${matches.length === 1 ? '' : 'es'}`}>
        If this is a different {noun} that just shares a phone number or name, choose Create anyway. Otherwise open the existing record instead.
      </Alert>
      <ul className="mt-3 space-y-2" aria-label="Possible duplicates">
        {matches.map((m, i) => (
          <li
            key={`${m.id}-${i}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white px-3.5 py-2.5 dark:border-surface-border dark:bg-surface-card"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <Avatar size={32} name={m.name || m.houseName} />
              <div className="min-w-0">
              <p className="truncate text-[13px] font-bold text-[#18231E] dark:text-surface-text">
                {m.name || m.houseName || 'Unnamed'}
                {m.mahallId && <span className="ml-2 text-xs font-semibold text-[#7B8983] dark:text-surface-muted">{m.mahallId}</span>}
              </p>
              <p className="truncate text-xs text-[#5B6963] dark:text-surface-muted">
                {[m.name && m.houseName ? `House: ${m.houseName}` : undefined, m.familyHead ? `Head: ${m.familyHead}` : undefined, m.row ? `Row ${m.row}` : undefined]
                  .filter(Boolean)
                  .join(' · ') || ' '}
              </p>
              <div className="mt-1">
                <Badge variant="warning" size="sm">{m.reason}</Badge>
              </div>
              </div>
            </div>
            {linkable(m) && (
              <a
                href={href(m)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 max-sm:min-h-10 text-xs font-bold text-primary-600 hover:underline dark:text-brand-lime"
              >
                Open existing <FiExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            )}
          </li>
        ))}
      </ul>
    </Modal>
  );
}
