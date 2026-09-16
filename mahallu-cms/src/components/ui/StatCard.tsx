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
  /**
   * `compact` is for a secondary grid shown alongside a page's real headline
   * numbers — e.g. the Dashboard's "Community registers" row under its four
   * key stats. Same data, a visibly quieter treatment, so one grid doesn't
   * compete with the other for attention.
   */
  size?: 'default' | 'compact';
  /*
   * Present only when the card genuinely navigates. Renders it as a button. */
  onClick?: () => void;
  className?: string;
}

/* Callers pass their glyph at whatever size their page happened to use —
 * h-5, h-6, occasionally unsized. The child selector outranks the class on
 * the svg itself, so every stat icon is a fixed size without touching a call site. */
const ICON_BOX = {
  default: 'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md [&>svg]:h-[18px] [&>svg]:w-[18px]',
  compact: 'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md [&>svg]:h-4 [&>svg]:w-4',
};

/* The icon tile carries the tone too, not just the number under it — a
 * warning stat should read as attention-worthy at a glance, before the
 * figure is even read. `default` stays neutral: colour is reserved for a
 * number that means something is wrong or worth acting on. */
const ICON_TONE_CLASS = {
  default: 'bg-muted text-muted-foreground',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
  info: 'bg-info/10 text-info',
} as const;

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
  size = 'default',
  onClick,
  className,
}: StatCardProps) {
  const compact = size === 'compact';
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-label font-medium text-muted-foreground">{title}</p>
        {icon && (
          <span className={cn(ICON_BOX[size], ICON_TONE_CLASS[tone])} aria-hidden="true">
            {icon}
          </span>
        )}
      </div>
      <p
        className={cn(
          'mt-1.5 truncate font-semibold leading-none tabular-nums tracking-tight',
          compact ? 'text-lg' : 'text-3xl',
          TONE_CLASS[tone]
        )}
      >
        {value}
      </p>
      {(hint || trend) && (
        <div className="mt-2 flex items-center gap-2">
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
          'w-full rounded-lg border border-border bg-card text-left shadow-sm transition-all',
          compact ? 'p-3' : 'p-4',
          'hover:-translate-y-px hover:shadow-md',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          className
        )}
      >
        {body}
      </button>
    );
  }

  return (
    <Card padding="none" className={cn(compact ? 'p-3' : 'p-4', className)}>
      {body}
    </Card>
  );
}
