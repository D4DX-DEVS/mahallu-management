import { ReactNode } from 'react';
import { FiArrowUp, FiArrowDown } from 'react-icons/fi';
import Card from './Card';
import { cn } from '@/utils/cn';
/*
 * One stat card for the whole product. `StatCard` and `DashboardStatCard` used
 * to coexist with different label case, icon sizes, radii and — worst — a
 * different icon for the same "trend up" meaning. */
export interface StatCardProps {
  /*
   * Sentence case. Not uppercase-with-letter-spacing. */
  title: string;
  value: string | number;
  icon?: ReactNode;
  /*
   * Second line under the value, e.g. "of 348 families". */
  hint?: string;
  trend?: { value: number; isPositive: boolean };
  /*
   * Present only when the card genuinely navigates. Renders it as a button. */
  onClick?: () => void;
  className?: string;
}
export default function StatCard({ title, value, icon, hint, trend, onClick, className }: StatCardProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 text-label font-medium text-muted-foreground">{title}</p>
        {icon && (
          <span
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
      </div>
      <p className="mt-2 truncate text-2xl font-semibold tabular-nums tracking-tight text-foreground">
        {value}
      </p>
      <div className="mt-1 flex items-center gap-2">
        {hint && <span className="text-label text-muted-foreground">{hint}</span>}
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
          'w-full rounded-lg border border-border bg-card p-4 text-left shadow-sm transition-colors',
          'hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          className
        )}
      >
        {body}
      </button>
    );
  }

  return (
    <Card padding="md" className={className}>
      {body}
    </Card>
  );
}
