import type { FillState } from '@/services/surveyFormService';

/** Status badge for a survey: its lifecycle and, once published, whether it is taking responses. */
export const surveyBadge = (fillState: FillState): { status: string; label: string } => {
  switch (fillState) {
    case 'draft':
      return { status: 'draft', label: 'Draft' };
    case 'scheduled':
      return { status: 'scheduled', label: 'Scheduled' };
    case 'open':
      return { status: 'active', label: 'Open' };
    case 'ended':
      return { status: 'expired', label: 'Period ended' };
    case 'closed':
    default:
      return { status: 'closed', label: 'Closed' };
  }
};

export const formatDay = (value?: string | null) => {
  if (!value) return '';
  const [y, m, d] = value.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatPeriod = (start?: string | null, end?: string | null) =>
  start ? `${formatDay(start)} – ${end ? formatDay(end) : 'ongoing'}` : '—';

export const formatDateTime = (value?: string | null) =>
  value ? new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';

export const SUBMISSION_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  pending: 'Pending review',
  accepted: 'Accepted',
  rejected: 'Rejected',
};
