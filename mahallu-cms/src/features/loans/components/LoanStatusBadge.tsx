import Badge, { BadgeVariant } from '@/components/ui/Badge';
import { LoanStatus, InstallmentStatus, ReliefStatus, ReliefUrgency } from '@/services/qardService';

const PILL = 'capitalize whitespace-nowrap';

const LOAN_TONES: Record<LoanStatus, BadgeVariant> = {
  applied: 'neutral',
  under_review: 'info',
  approved: 'primary',
  rejected: 'danger',
  disbursed: 'solid',
  repaying: 'info',
  closed: 'success',
  defaulted: 'danger',
};

const INSTALLMENT_TONES: Record<InstallmentStatus, BadgeVariant> = {
  due: 'neutral',
  partial: 'warning',
  paid: 'success',
  overdue: 'danger',
};

const RELIEF_TONES: Record<ReliefStatus, BadgeVariant> = {
  reported: 'neutral',
  verified: 'info',
  approved: 'primary',
  assisted: 'success',
  closed: 'neutral',
};

const URGENCY_TONES: Record<ReliefUrgency, BadgeVariant> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
  critical: 'danger',
};

const label = (value: string) => value.replace(/_/g, ' ');

export default function LoanStatusBadge({ status }: { status: LoanStatus }) {
  const tone = LOAN_TONES[status] || LOAN_TONES.applied;
  return (
    <Badge variant={tone} dot={tone !== 'solid'} className={PILL}>
      {label(status)}
    </Badge>
  );
}

export function InstallmentBadge({ status }: { status: InstallmentStatus }) {
  const tone = INSTALLMENT_TONES[status] || INSTALLMENT_TONES.due;
  return (
    <Badge variant={tone} dot className={PILL}>
      {status}
    </Badge>
  );
}

export function ReliefStatusBadge({ status }: { status: ReliefStatus }) {
  const tone = RELIEF_TONES[status] || RELIEF_TONES.reported;
  return (
    <Badge variant={tone} dot className={PILL}>
      {status}
    </Badge>
  );
}

export function UrgencyBadge({ urgency }: { urgency: ReliefUrgency }) {
  const tone = URGENCY_TONES[urgency] || URGENCY_TONES.medium;
  return (
    <Badge variant={tone} dot className={PILL}>
      {urgency}
    </Badge>
  );
}
