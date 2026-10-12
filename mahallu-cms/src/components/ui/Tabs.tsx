import { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface TabOption<T extends string = string> {
  value: T;
  label: ReactNode;
  count?: number | string;
  disabled?: boolean;
}

export interface TabsProps<T extends string = string> {
  tabs: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  'aria-label'?: string;
}

/** Underline tabs (Overview / Members / Payments ...). Controlled; render the panel yourself. */
export default function Tabs<T extends string = string>({ tabs, value, onChange, className, ...rest }: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={rest['aria-label']}
      className={cn('no-scrollbar flex max-w-full gap-5 overflow-x-auto overscroll-x-contain border-b border-line dark:border-surface-border', className)}
    >
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={t.disabled}
            onClick={() => onChange(t.value)}
            className={cn(
              '-mb-px inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 pb-2.5 text-[12.5px] max-sm:min-h-[40px] max-sm:pb-0 transition-colors',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] rounded-t-md',
              'disabled:opacity-40',
              active
                ? 'border-primary-700 font-bold text-primary-700 dark:border-brand-lime dark:text-brand-lime'
                : 'border-transparent font-semibold text-[#7B8983] hover:text-[#18231E] dark:text-surface-muted dark:hover:text-surface-text'
            )}
          >
            {t.label}
            {t.count !== undefined && (
              <span className="rounded-full bg-[#EEF3F0] px-1.5 text-[12px] font-bold text-[#5B6963] dark:bg-surface-raised dark:text-surface-muted">
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
