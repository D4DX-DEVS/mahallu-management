/**
 * BloodGroupBadge - blood group as a round badge (30px; size "sm" 24px, "xs" 20px
 * for use as an Avatar corner badge).
 *
 * Usage
 *   <BloodGroupBadge value={member.bloodGroup} />            // 'O +ve' -> O+
 *   <BloodGroupBadge value="AB -ve" size="sm" />             // AB−  (proper minus sign)
 *   <BloodGroupBadge value={undefined} />                     // unknown -> en dash
 *
 * Accepts the API values ('O +ve', 'B -ve', 'AB +ve') and compact/spelled forms
 * ('O+', 'a negative'). Rh-positive = filled red tint with a ring; rh-negative =
 * white with a red ring. Exposes aria-label "Blood group O positive".
 * normalizeBloodGroup(value) returns { label, name, positive } or null.
 */
import { cn } from '@/utils/cn';

const RE = /^\s*(AB|A|B|O)\s*(\+|-|−|–|pos(?:itive)?|neg(?:ative)?)\s*(?:ve)?\s*$/i;

export function normalizeBloodGroup(value?: string | null): { label: string; name: string; positive: boolean } | null {
  if (!value) return null;
  const m = RE.exec(String(value));
  if (!m) return null;
  const group = m[1].toUpperCase();
  const positive = /^(\+|pos)/i.test(m[2]);
  return { label: `${group}${positive ? '+' : '−'}`, name: `${group} ${positive ? 'positive' : 'negative'}`, positive };
}

export interface BloodGroupBadgeProps {
  value?: string | null;
  size?: 'md' | 'sm' | 'xs';
  className?: string;
}

const SIZE = {
  md: 'h-[30px] w-[30px] text-[12px]',
  sm: 'h-6 w-6 text-[9.5px]',
  xs: 'h-5 w-5 text-[8px] border-2 border-white dark:border-surface-card',
};

export default function BloodGroupBadge({ value, size = 'md', className }: BloodGroupBadgeProps) {
  const bg = normalizeBloodGroup(value);
  const base = cn('inline-flex shrink-0 items-center justify-center rounded-full font-extrabold leading-none tracking-[-0.02em]', SIZE[size], className);
  if (!bg) {
    return (
      <span className={cn(base, 'text-[#98A59F] dark:text-surface-muted')} aria-label="Blood group not recorded" title="Blood group not recorded">
        –
      </span>
    );
  }
  return (
    <span
      className={cn(
        base,
        bg.positive
          ? 'bg-[#FDECEA] text-[#B3261E] shadow-[inset_0_0_0_1.5px_#F4C7C3] dark:bg-red-500/15 dark:text-red-300 dark:shadow-[inset_0_0_0_1.5px_rgba(248,113,113,.35)]'
          : 'bg-white text-[#B3261E] shadow-[inset_0_0_0_1.5px_#D9534F] dark:bg-transparent dark:text-red-300 dark:shadow-[inset_0_0_0_1.5px_rgba(248,113,113,.6)]'
      )}
      aria-label={`Blood group ${bg.name}`}
      title={`Blood group ${bg.name}`}
    >
      {bg.label}
    </span>
  );
}
