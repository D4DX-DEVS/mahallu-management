import { ReactNode } from 'react';
import { FiArrowUp, FiArrowDown } from 'react-icons/fi';
import Card from './Card';
import { cn } from '@/utils/cn';
/*
 * One stat card for the whole product. `StatCard` and `DashboardStatCard` used
 * to coexist with different label case, icon sizes, radii and — worst — a
 * different icon for the same "trend up" meaning.
 *
 * It is deliberately short. A row of four of these sits between the page title
 * and the table that is the actual work, so every pixel it spends pushes the
 * list further below the fold: 12px of padding, one line of label, one line of
 * value, and a third line only when there is something to put on it. The
 * `hint`/`trend` row used to render unconditionally, so the eighty-odd pages
 * that pass neither paid 24px per card for an empty line.
 */
export interface StatCardProps {
  /*
   * Sentence case. Not uppercase-with-letter-spacing. */
  title: string;
  /* Usually a number or a formatted string. `ReactNode` because a figure is
   * often a currency symbol next to an expression — `<>₹{total.toLocaleString()}</>`
   * — which is one value, not a reason to hand-roll the card. */
  value: ReactNode;
  icon?: ReactNode;
  /*
   * Second line under the value, e.g. "of 348 families". */
  hint?: ReactNode;
  trend?: { value: number; isPositive: boolean };
  /*
   * Colours the value when the number itself carries a state — an overdue
   * count, a missing-data count, a balance in deficit. Pages used to hand-roll
   * these cards purely to paint the figure amber or red. Default for anything
   * that is only a quantity. */
  tone?: 'default' | 'success' | 'warning' | 'destructive' | 'info';
  /*
   * Present only when the card genuinely navigates. Renders it as a button. */
  onClick?: () => void;
  className?: string;
}

/* Callers pass their glyph at whatever size their page happened to use —
 * h-5, h-6, occasionally unsized. The child selector outranks the class on
 * the svg itself, so every stat icon is 16px without touching a call site. */
const ICON_BOX =
  'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&>svg]:h-4 [&>svg]:w-4';

const TONE_CLASS = {
  default: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning',
  destructive: 'text-destructive',
  info: 'text-info',
} as const;

export default function StatCard({
  title,
  value,
  icon,
  hint,
  trend,
  tone = 'default',
  onClick,
  className,
}: StatCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-label font-medium text-muted-foreground">{title}</p>
        {icon && (
          <span className={ICON_BOX} aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <p
        className={cn(
          'mt-1 truncate text-2xl font-semibold leading-tight tabular-nums tracking-tight',
          TONE_CLASS[tone]
        )}
      >
        {value}
      </p>
      {(hint || trend) && (
        <div className="mt-1 flex items-center gap-2">
          {hint && <span className="truncate text-xs text-muted-foreground">{hint}</span>}
          {trend && (
            <span
              className={cn(
                'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
                trend.isPositive ? 'text-success' : 'text-destructive'
              )}
            >
              {trend.isPositive ? (
                <FiArrowUp className="h-3 w-3" aria-hidden="true" />
              ) : (
                <FiArrowDown className="h-3 w-3" aria-hidden="true" />
              )}
              {Math.abs(trend.value)}%
              <span className="sr-only">{trend.isPositive ? 'increase' : 'decrease'}</span>
            </span>
          )}
        </div>
      )}
    </>
  );
  /*
   * Clickable stats are real buttons: focusable, keyboard-operable and
   * announced as controls. Non-clickable stats get no hover affordance. */
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'w-full rounded-lg border border-border bg-card p-3 text-left shadow-none transition-colors sm:shadow-sm',
          'hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          className
        )}
      >
        {body}
      </button>
    );
  }

  return (
    <Card padding="none" className={cn('p-3', className)}>
      {body}
    </Card>
  );
}
