import { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: ReactNode;
  /** Optional small count shown after the label */
  count?: number | string;
}

export interface SegmentedProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
  className?: string;
  'aria-label'?: string;
}

/** Pill-style single-choice control (7 days / 30 days / Year, All / Approved / Pending ...). */
export default function Segmented<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
  ...rest
}: SegmentedProps<T>) {
  return (
    <div
      role="group"
      aria-label={rest['aria-label']}
      className={cn('no-scrollbar inline-flex max-w-full flex-nowrap overflow-x-auto rounded-[10px] bg-[#EAF0EC] p-[3px] dark:bg-surface-base', className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg font-semibold transition-colors max-sm:min-h-[36px]',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28]',
              size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3.5 py-1.5 text-xs',
              active
                ? 'bg-white font-bold text-primary-700 shadow-[0_1px_3px_rgba(11,72,55,.15)] dark:bg-surface-raised dark:text-brand-lime dark:shadow-none'
                : 'text-[#5B6963] hover:text-[#18231E] dark:text-surface-muted dark:hover:text-surface-text'
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span className={cn('text-[12px] font-bold', active ? 'text-primary-600 dark:text-brand-lime' : 'text-[#98A59F]')}>
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
