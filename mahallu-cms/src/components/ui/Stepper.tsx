import { FiCheck } from 'react-icons/fi';
import { cn } from '@/utils/cn';

export interface StepperProps {
  steps: { id: string; label: string }[];
  /** Zero-based active step */
  current: number;
  /** Highest step index the user has reached; earlier/visited steps are clickable */
  maxVisited?: number;
  onStepClick?: (index: number) => void;
  className?: string;
}

/** Numbered circles joined by a connector line (ZAAD form wizard). */
export default function Stepper({ steps, current, maxVisited = current, onStepClick, className }: StepperProps) {
  return (
    <ol className={cn('flex items-center gap-2.5', className)} aria-label="Form progress">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const reachable = i <= maxVisited && !!onStepClick;
        return (
          <li key={s.id} className={cn('flex items-center gap-2.5', i < steps.length - 1 && 'flex-1')}>
            <button
              type="button"
              disabled={!reachable || active}
              onClick={() => onStepClick?.(i)}
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex items-center gap-2 max-sm:min-h-10 max-sm:min-w-10 max-sm:justify-center whitespace-nowrap rounded-full text-xs focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28]',
                active ? 'font-bold text-primary-700 dark:text-brand-lime' : done ? 'font-semibold text-primary-700 dark:text-brand-lime' : 'font-semibold text-[#7B8983] dark:text-surface-muted',
                reachable && !active ? 'cursor-pointer' : 'cursor-default'
              )}
            >
              <span
                className={cn(
                  'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[12px] transition-colors',
                  active || done
                    ? 'bg-primary-700 text-white dark:bg-brand-lime dark:text-primary-950'
                    : 'border-[1.5px] border-line-strong bg-white dark:border-surface-border-strong dark:bg-surface-raised'
                )}
              >
                {done ? <FiCheck className="h-3 w-3" aria-hidden="true" /> : i + 1}
              </span>
              <span className={cn(!active && 'hidden sm:inline')}>{s.label}</span>
            </button>
            {i < steps.length - 1 && (
              <i
                aria-hidden="true"
                className={cn(
                  'h-0.5 min-w-[12px] flex-1 rounded-full',
                  i < current
                    ? 'bg-gradient-to-r from-primary-700 to-primary-700 dark:from-brand-lime dark:to-brand-lime'
                    : i === current
                      ? 'bg-gradient-to-r from-primary-700 to-line-strong dark:from-brand-lime dark:to-surface-border-strong'
                      : 'bg-line-strong dark:bg-surface-border-strong'
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
