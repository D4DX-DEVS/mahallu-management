import { LoanStatus, InstallmentStatus, ReliefStatus, ReliefUrgency } from '@/services/qardService';

const PILL = 'inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize whitespace-nowrap';

const LOAN_COLORS: Record<LoanStatus, string> = {
  applied: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  under_review: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  approved: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  disbursed: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  repaying: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  closed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  defaulted: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const INSTALLMENT_COLORS: Record<InstallmentStatus, string> = {
  due: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  partial: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const RELIEF_COLORS: Record<ReliefStatus, string> = {
  reported: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  verified: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  approved: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  assisted: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  closed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
};

const URGENCY_COLORS: Record<ReliefUrgency, string> = {
  low: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  medium: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  high: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const label = (value: string) => value.replace(/_/g, ' ');

export default function LoanStatusBadge({ status }: { status: LoanStatus }) {
  return <span className={`${PILL} ${LOAN_COLORS[status] || LOAN_COLORS.applied}`}>{label(status)}</span>;
}

export function InstallmentBadge({ status }: { status: InstallmentStatus }) {
  return <span className={`${PILL} ${INSTALLMENT_COLORS[status] || INSTALLMENT_COLORS.due}`}>{status}</span>;
}

export function ReliefStatusBadge({ status }: { status: ReliefStatus }) {
  return <span className={`${PILL} ${RELIEF_COLORS[status] || RELIEF_COLORS.reported}`}>{status}</span>;
}

export function UrgencyBadge({ urgency }: { urgency: ReliefUrgency }) {
  return <span className={`${PILL} ${URGENCY_COLORS[urgency] || URGENCY_COLORS.medium}`}>{urgency}</span>;
}
