/**
 * GenderChip - small pill for gender: Male (blue), Female (purple), anything else neutral.
 *
 * Usage
 *   <GenderChip value={member.gender} />        // "Male"
 *   <GenderChip value="female" short />          // "F"
 * Unknown/empty renders an en dash.
 */
import { cn } from '@/utils/cn';

export interface GenderChipProps {
  value?: string | null;
  short?: boolean;
  className?: string;
}

export default function GenderChip({ value, short, className }: GenderChipProps) {
  const v = (value || '').trim().toLowerCase();
  if (!v) return <span className="text-[#98A59F] dark:text-surface-muted" aria-label="Gender not recorded">–</span>;
  const tone =
    v === 'male' || v === 'm'
      ? 'bg-[#E8F0FB] text-[#1F4E8C] dark:bg-blue-400/15 dark:text-blue-300'
      : v === 'female' || v === 'f'
        ? 'bg-[#F3ECFA] text-[#5B3A8C] dark:bg-purple-400/15 dark:text-purple-300'
        : 'bg-[#EEF3F0] text-[#4A5A52] dark:bg-surface-raised dark:text-surface-muted';
  const label = v === 'm' ? 'Male' : v === 'f' ? 'Female' : v.charAt(0).toUpperCase() + v.slice(1);
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-[9px] py-[3px] text-[12px] font-bold leading-none', tone, className)}
      aria-label={`Gender ${label}`}
      title={short ? label : undefined}
    >
      {short ? label.charAt(0) : label}
    </span>
  );
}
