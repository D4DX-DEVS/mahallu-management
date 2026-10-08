import { ReactNode } from 'react';
import {
  RiArrowDownLine,
  RiArrowUpLine,
  RiBarChartBoxLine,
  RiCalendarLine,
  RiCheckboxCircleLine,
  RiErrorWarningLine,
  RiFileTextLine,
  RiGroupLine,
  RiHome5Line,
  RiMenLine,
  RiTimeLine,
  RiWallet3Line,
  RiWomenLine,
} from 'react-icons/ri';
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

/* Every stat carries a glyph. Callers that pass none get one chosen from the
 * title, so a row of four cards never mixes iconned and bare tiles. */
const FALLBACK_ICONS: Array<[RegExp, ReactNode]> = [
  [/\bfemale|women|girl/i, <RiWomenLine />],
  [/\bmale|\bmen\b|boy/i, <RiMenLine />],
  [/famil|house|household|home/i, <RiHome5Line />],
  [/member|people|user|person|volunteer|staff|employee|student|beneficiar/i, <RiGroupLine />],
  [/pending|due|await|waiting|scheduled|upcoming/i, <RiTimeLine />],
  [/reject|overdue|fail|unpaid|missing|error|critical|expired/i, <RiErrorWarningLine />],
  [/approv|active|complete|verified|paid|issued|resolved|done/i, <RiCheckboxCircleLine />],
  [/amount|total|₹|income|collect|balance|fund|revenue|expense|salary|payment|cash|zakat|loan|donat/i, <RiWallet3Line />],
  [/event|meeting|date|month|year|today|week/i, <RiCalendarLine />],
  [/certificate|document|file|record|request|application|noc/i, <RiFileTextLine />],
];

function fallbackIcon(title: string): ReactNode {
  return FALLBACK_ICONS.find(([pattern]) => pattern.test(title))?.[1] ?? <RiBarChartBoxLine />;
}

/* Callers pass their glyph at whatever size; the child selector fixes it. */
const ICON_BOX = {
  default: 'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border [&>svg]:h-5 [&>svg]:w-5',
  compact: 'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border [&>svg]:h-[18px] [&>svg]:w-[18px]',
};

/* The tile carries the tone too, so a warning stat reads as one at a glance. */
const ICON_TONE_CLASS = {
  default: 'border-primary/15 bg-primary/5 text-primary',
  success: 'border-success/20 bg-success/10 text-success',
  warning: 'border-warning/20 bg-warning/10 text-warning',
  destructive: 'border-destructive/20 bg-destructive/10 text-destructive',
  info: 'border-info/20 bg-info/10 text-info',
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
  /* One row: icon tile, then label over value. About 64px tall. */
  const body = (
    <div className="flex items-center gap-3">
      <span className={cn(ICON_BOX[size], ICON_TONE_CLASS[tone])} aria-hidden="true">
        {icon ?? fallbackIcon(title)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-muted-foreground">{title}</p>
        <div className="mt-0.5 flex items-baseline gap-2">
          <p
            className={cn(
              'truncate font-semibold leading-tight tabular-nums tracking-tight',
              compact ? 'text-base' : 'text-lg',
              TONE_CLASS[tone]
            )}
          >
            {value}
          </p>
          {trend && (
            <span
              className={cn(
                'inline-flex flex-shrink-0 items-center gap-0.5 text-xs font-medium tabular-nums',
                trend.isPositive ? 'text-success' : 'text-destructive'
              )}
            >
              {trend.isPositive ? (
                <RiArrowUpLine className="h-3 w-3" aria-hidden="true" />
              ) : (
                <RiArrowDownLine className="h-3 w-3" aria-hidden="true" />
              )}
              {Math.abs(trend.value)}%
              <span className="sr-only">{trend.isPositive ? 'increase' : 'decrease'}</span>
            </span>
          )}
        </div>
        {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
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
          'w-full rounded-xl border border-border bg-card text-left shadow-sm transition-all',
          compact ? 'px-3 py-2.5' : 'px-3.5 py-3',
          'hover:border-primary/30 hover:shadow-md',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
          className
        )}
      >
        {body}
      </button>
    );
  }

  return (
    <Card padding="none" className={cn(compact ? 'px-3 py-2.5' : 'px-3.5 py-3', className)}>
      {body}
    </Card>
  );
}
