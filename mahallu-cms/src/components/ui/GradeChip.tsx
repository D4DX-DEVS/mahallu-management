/**
 * GradeChip - Varisangya grade as a square-ish (8px radius) pill: A green, B blue, C gold.
 *
 * Usage
 *   <GradeChip value={family.varisangyaGrade} />   // 'Grade A' or 'A' -> A
 * Other letters render neutral; unknown/empty renders an en dash.
 */
import { cn } from '@/utils/cn';

const TONE: Record<string, string> = {
  A: 'bg-[#EEF6DF] text-[#3F6B0E] dark:bg-lime-400/15 dark:text-lime-300',
  B: 'bg-[#E8F0FB] text-[#1F4E8C] dark:bg-blue-400/15 dark:text-blue-300',
  C: 'bg-[#FFF6CC] text-[#7A5B00] dark:bg-yellow-400/15 dark:text-yellow-300',
};

export interface GradeChipProps {
  value?: string | null;
  className?: string;
}

export default function GradeChip({ value, className }: GradeChipProps) {
  const letter = (value || '').replace(/grade/i, '').trim().toUpperCase().slice(0, 2);
  if (!letter) return <span className="text-[#98A59F] dark:text-surface-muted" aria-label="Grade not set">–</span>;
  return (
    <span
      className={cn(
        'inline-flex min-w-[26px] items-center justify-center rounded-lg px-[9px] py-[2px] text-[12px] font-bold leading-[1.5]',
        TONE[letter] ?? 'bg-[#EEF3F0] text-[#4A5A52] dark:bg-surface-raised dark:text-surface-muted',
        className
      )}
      aria-label={`Varisangya grade ${letter}`}
    >
      {letter}
    </span>
  );
}
