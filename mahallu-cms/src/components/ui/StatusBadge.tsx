import { IconType } from 'react-icons';
import {
  RiCheckboxCircleFill,
  RiCloseCircleFill,
  RiIndeterminateCircleFill,
  RiLoader2Line,
  RiTimeFill,
} from 'react-icons/ri';
import { cn } from '@/utils/cn';

/**
 * The product's status vocabulary. One map, one meaning, one colour.
 *
 * Before this existed, 27 pages each defined a private status-to-colour object
 * and several rendered the raw value, so users saw strings like `in_progress`.
 * Add new statuses here, never in a page — the lint rule enforces it.
 *
 * The Flutter app carries the identical map, so a status reads the same on both
 * surfaces of the product.
 */
export type StatusTone = 'neutral' | 'pending' | 'progress' | 'positive' | 'negative' | 'done';

interface StatusDef {
  label: string;
  tone: StatusTone;
}

const STATUS_MAP: Record<string, StatusDef> = {
  // Not yet submitted
  draft: { label: 'Draft', tone: 'neutral' },
  applied: { label: 'Applied', tone: 'neutral' },
  reported: { label: 'Reported', tone: 'pending' },
  due: { label: 'Due', tone: 'pending' },

  // Awaiting a decision
  pending: { label: 'Pending', tone: 'pending' },
  open: { label: 'Pending', tone: 'pending' },
  unapproved: { label: 'Pending', tone: 'pending' },
  submitted: { label: 'Pending', tone: 'pending' },
  requested: { label: 'Requested', tone: 'pending' },
  awaiting: { label: 'Pending', tone: 'pending' },
  planned: { label: 'Planned', tone: 'pending' },
  scheduled: { label: 'Scheduled', tone: 'pending' },
  on_leave: { label: 'On leave', tone: 'pending' },
  under_maintenance: { label: 'Under maintenance', tone: 'pending' },
  correction_required: { label: 'Correction required', tone: 'negative' },

  // Being worked on
  in_progress: { label: 'In progress', tone: 'progress' },
  'in-progress': { label: 'In progress', tone: 'progress' },
  inprogress: { label: 'In progress', tone: 'progress' },
  processing: { label: 'In progress', tone: 'progress' },
  ongoing: { label: 'Ongoing', tone: 'progress' },
  assigned: { label: 'Assigned', tone: 'progress' },
  in_use: { label: 'In use', tone: 'progress' },
  partial: { label: 'Partly paid', tone: 'progress' },
  under_review: { label: 'Under review', tone: 'progress' },
  repaying: { label: 'Repaying', tone: 'progress' },

  // Accepted, in force
  approved: { label: 'Approved', tone: 'positive' },
  verified: { label: 'Verified', tone: 'positive' },
  success: { label: 'Approved', tone: 'positive' },
  active: { label: 'Active', tone: 'positive' },
  paid: { label: 'Paid', tone: 'positive' },
  issued: { label: 'Issued', tone: 'positive' },
  disbursed: { label: 'Disbursed', tone: 'positive' },
  published: { label: 'Published', tone: 'positive' },
  valid: { label: 'Valid', tone: 'positive' },
  assisted: { label: 'Assisted', tone: 'positive' },

  // Declined
  rejected: { label: 'Rejected', tone: 'negative' },
  failed: { label: 'Failed', tone: 'negative' },
  overdue: { label: 'Overdue', tone: 'negative' },
  unpaid: { label: 'Unpaid', tone: 'negative' },
  revoked: { label: 'Revoked', tone: 'negative' },
  suspended: { label: 'Suspended', tone: 'negative' },
  damaged: { label: 'Damaged', tone: 'negative' },
  terminated: { label: 'Terminated', tone: 'negative' },
  defaulted: { label: 'Defaulted', tone: 'negative' },
  dropped: { label: 'Dropped', tone: 'negative' },

  // Finished, nothing left to do
  completed: { label: 'Completed', tone: 'done' },
  closed: { label: 'Closed', tone: 'done' },
  resolved: { label: 'Resolved', tone: 'done' },
  filled: { label: 'Filled', tone: 'done' },

  // Withdrawn or out of use
  cancelled: { label: 'Cancelled', tone: 'neutral' },
  canceled: { label: 'Cancelled', tone: 'neutral' },
  inactive: { label: 'Inactive', tone: 'neutral' },
  archived: { label: 'Archived', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'neutral' },
  disposed: { label: 'Disposed', tone: 'neutral' },
  unassigned: { label: 'Unassigned', tone: 'neutral' },
  resigned: { label: 'Resigned', tone: 'neutral' },
};

/* A neutral outlined pill; the tone lives in the glyph, so a column of
 * statuses reads as one calm list with the exceptions standing out. */
const TONE_ICON: Record<StatusTone, { Icon: IconType; className: string }> = {
  neutral: { Icon: RiIndeterminateCircleFill, className: 'text-muted-foreground/70' },
  pending: { Icon: RiTimeFill, className: 'text-warning' },
  progress: { Icon: RiLoader2Line, className: 'text-info' },
  positive: { Icon: RiCheckboxCircleFill, className: 'text-success' },
  negative: { Icon: RiCloseCircleFill, className: 'text-destructive' },
  done: { Icon: RiCheckboxCircleFill, className: 'text-muted-foreground' },
};

/** Turns any raw status value into its display label. Never renders snake_case. */
export function statusLabel(status?: string | null): string {
  if (!status) return '—';
  const key = String(status).toLowerCase().trim();
  if (STATUS_MAP[key]) return STATUS_MAP[key].label;
  // Unknown value: humanise it rather than leak the raw token.
  return key.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

export function statusTone(status?: string | null): StatusTone {
  if (!status) return 'neutral';
  return STATUS_MAP[String(status).toLowerCase().trim()]?.tone ?? 'neutral';
}

export interface StatusBadgeProps {
  status?: string | null;
  /** Overrides the mapped label where a module uses its own wording. */
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * State is encoded in shape and colour as well as the word, so what needs
 * attention reads at a glance rather than requiring the label to be read.
 */
export default function StatusBadge({ status, label, size = 'sm', className }: StatusBadgeProps) {
  const tone = statusTone(status);
  const text = label ?? statusLabel(status);

  const { Icon, className: iconClass } = TONE_ICON[tone];

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-md border border-border bg-card font-medium text-foreground/80 shadow-sm',
        size === 'sm' ? 'h-6 px-1.5 text-xs' : 'h-7 px-2 text-sm',
        className
      )}
    >
      <Icon className={cn('flex-shrink-0', size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4', iconClass)} aria-hidden="true" />
      {text}
    </span>
  );
}
