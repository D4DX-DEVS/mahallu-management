import Badge, { BadgeProps, BadgeVariant } from './Badge';

/** Maps free-form status strings used across the API to a ZAAD badge tone. */
const TONES: Record<string, BadgeVariant> = {
  // positive
  approved: 'success', active: 'success', paid: 'success', completed: 'success', complete: 'success',
  received: 'success', success: 'success', present: 'success', confirmed: 'success', resolved: 'success',
  // waiting
  pending: 'warning', partial: 'warning', 'in progress': 'warning', in_progress: 'warning', due: 'warning',
  review: 'warning', 'under review': 'warning', scheduled: 'warning', upcoming: 'warning',
  // negative
  rejected: 'danger', unapproved: 'danger', overdue: 'danger', failed: 'danger', expired: 'danger',
  cancelled: 'danger', canceled: 'danger', absent: 'danger', blocked: 'danger', deceased: 'danger',
  // informational
  verified: 'info', submitted: 'info', open: 'info', new: 'info', published: 'info',
  // neutral
  draft: 'neutral', inactive: 'neutral', closed: 'neutral', archived: 'neutral', unknown: 'neutral',
  // added for full coverage of list/detail statuses, priorities and money direction
  delivered: 'success', distributed: 'success', filled: 'success', returned: 'success', sent: 'success', stable: 'success',
  registered: 'success', available: 'success', 'on-track': 'success', on_track: 'success', income: 'success', credit: 'success',
  assigned: 'info', applied: 'info', documentation: 'info', in_use: 'info', 'in use': 'info', issued: 'info', planned: 'info',
  receiving: 'info', referred: 'info', reported: 'info', medium: 'info', ongoing: 'info',
  proposed: 'warning', requested: 'warning', follow_up: 'warning', 'follow up': 'warning', mediation: 'warning', needs_assistance: 'warning',
  needs_review: 'warning', on_leave: 'warning', under_maintenance: 'warning', high: 'warning',
  unpaid: 'danger', dropped: 'danger', struggling: 'danger', suspended: 'danger', terminated: 'danger', damaged: 'danger',
  lost: 'danger', urgent: 'danger', critical: 'danger', expense: 'danger', debit: 'danger',
  disposed: 'neutral', queued: 'neutral', resigned: 'neutral', skipped: 'neutral', none: 'neutral', low: 'neutral', over: 'neutral',
  // strong (final state)
  disbursed: 'solid',
};

export function statusTone(status?: string | null): BadgeVariant {
  if (!status) return 'neutral';
  return TONES[status.toString().trim().toLowerCase()] ?? 'neutral';
}

export interface StatusBadgeProps extends Omit<BadgeProps, 'variant' | 'children' | 'dot'> {
  status?: string | null;
  /** Override the displayed text (defaults to a capitalised status) */
  label?: string;
  /** Force a tone instead of inferring it from the status */
  tone?: BadgeVariant;
  dot?: boolean;
}

function titleCase(v: string) {
  const t = v.replace(/[_-]+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export default function StatusBadge({ status, label, tone, dot, ...props }: StatusBadgeProps) {
  const variant = tone ?? statusTone(status);
  return (
    <Badge variant={variant} dot={dot ?? variant !== 'solid'} {...props}>
      {label ?? (status ? titleCase(String(status)) : '-')}
    </Badge>
  );
}
