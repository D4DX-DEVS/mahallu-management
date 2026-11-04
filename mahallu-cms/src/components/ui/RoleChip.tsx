/**
 * RoleChip - role inside a family: Head (dark green solid), Spouse / Child / other (neutral).
 *
 * Usage
 *   <RoleChip role="head" />
 *   <RoleChip isHead={member.isFamilyHead} role={member.relation} />   // head wins
 * Renders nothing when there is neither a role nor isHead.
 */
import { cn } from '@/utils/cn';

export interface RoleChipProps {
  role?: string | null;
  isHead?: boolean;
  className?: string;
}

export default function RoleChip({ role, isHead, className }: RoleChipProps) {
  const r = (role || '').trim();
  const head = isHead || /^(family\s*)?head$/i.test(r);
  if (!head && !r) return null;
  const label = head ? 'Head' : r.charAt(0).toUpperCase() + r.slice(1).toLowerCase();
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-[3px] text-[12px] font-bold leading-none',
        head
          ? 'bg-[#0B4837] text-white dark:bg-brand-lime dark:text-primary-950'
          : 'bg-[#EEF3F0] text-[#4A5A52] dark:bg-surface-raised dark:text-surface-muted',
        className
      )}
    >
      {label}
    </span>
  );
}
