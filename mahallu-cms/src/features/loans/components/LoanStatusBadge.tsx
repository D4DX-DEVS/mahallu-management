import { LoanStatus, InstallmentStatus, ReliefStatus, ReliefUrgency } from '@/services/qardService';
import StatusBadge from '@/components/ui/StatusBadge';
import { cn } from '@/utils/cn';

export default function LoanStatusBadge({ status }: { status: LoanStatus }) {
  return <StatusBadge status={status} />;
}

export function InstallmentBadge({ status }: { status: InstallmentStatus }) {
  return <StatusBadge status={status} />;
}

export function ReliefStatusBadge({ status }: { status: ReliefStatus }) {
  return <StatusBadge status={status} />;
}

/* Urgency is a priority axis, not a workflow state, so it doesn't belong in
 * StatusBadge's status vocabulary — but it shares the same token ramp and pill
 * shape rather than inventing its own colours. */
const URGENCY_CLASSES: Record<ReliefUrgency, string> = {
  low: 'bg-muted text-muted-foreground ring-border',
  medium: 'bg-info/10 text-info ring-info/25',
  high: 'bg-warning/10 text-warning ring-warning/25',
  critical: 'bg-destructive/10 text-destructive ring-destructive/25',
};

const URGENCY_LABELS: Record<ReliefUrgency, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

export function UrgencyBadge({ urgency }: { urgency: ReliefUrgency }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-medium ring-1 ring-inset',
        URGENCY_CLASSES[urgency] ?? URGENCY_CLASSES.medium
      )}
    >
      {URGENCY_LABELS[urgency] ?? urgency}
    </span>
  );
}
