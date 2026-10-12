import { ReactNode } from 'react';
import { FiTrendingUp, FiTrendingDown, FiDollarSign, FiUsers, FiCheckCircle, FiClock, FiBarChart2, FiHome, FiCalendar } from 'react-icons/fi';
import Card from './Card';
import { cn } from '@/utils/cn';
import StatVizGraphic, { StatViz } from './stat-viz';

export type { StatViz } from './stat-viz';

export type StatTone = 'green' | 'lime' | 'gold' | 'red' | 'neutral';

export interface StatCardProps {
  title: string;
  /** A string/number, or a node such as a status badge (then pass `summary` for assistive tech). */
  value: string | number | ReactNode;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
    /** Text after the percentage, e.g. "vs last month" */
    suffix?: string;
  };
  onClick?: () => void;
  className?: string;
  /** Icon chip colour. Gold is for the rare highlight; default is green. */
  tone?: StatTone;
  /** `tile` = KPI card (title row, big number, delta). `inline` = compact chip + number (list-page summaries). */
  variant?: 'tile' | 'inline';
  /** Small pill(s) under the value, e.g. "36 students". Plain data only. */
  pills?: string[];
  /** Real series only. Rendered as a mini area sparkline on the right of the tile. */
  sparkline?: number[];
  /** 0-100 progress bar under the value with optional caption */
  progress?: { value: number; caption?: string };
  /** Small graphic bottom-right. Pick the design by what the number means. Real data only. */
  viz?: StatViz;
  /** Spoken summary for assistive tech, e.g. "Approved 22 of 28 families, 79 percent". Defaults to title, value and pills. */
  summary?: string;
}

const FRAME =
  'rounded-[14px] border-[#E3EAE6] shadow-[0_1px_2px_rgba(11,72,55,.04),0_10px_24px_-16px_rgba(11,72,55,.18)]';

const CHIP: Record<StatTone, string> = {
  green: 'bg-mint text-primary-700 dark:bg-brand-lime/15 dark:text-brand-lime',
  lime: 'bg-[#EEF6DF] text-primary-600 dark:bg-brand-lime/15 dark:text-brand-lime',
  gold: 'bg-[#FFF6CC] text-[#7A5B00] dark:bg-secondary-500/15 dark:text-secondary-300',
  red: 'bg-[#FDECEA] text-[#B3261E] dark:bg-red-500/15 dark:text-red-300',
  neutral: 'bg-[#EEF3F0] text-[#4A5A52] dark:bg-surface-raised dark:text-surface-muted',
};

/** Chip icon when a caller does not pass one, picked from the card title. */
function defaultIcon(title: string): ReactNode {
  const t = title.toLowerCase();
  if (/amount|balance|paid|income|expense|spent|cost|total given|disbursed|repaid|outstanding|due|salary|float|debit|credit|surplus|deficit|requested|collected|distributed/.test(t)) return <FiDollarSign />;
  if (/member|user|staff|student|worker|seeker|volunteer|men|women|male|female|beneficiar|participant|orphan/.test(t)) return <FiUsers />;
  if (/famil|house|class|committee|institute|tenant/.test(t)) return <FiHome />;
  if (/pending|open|waiting|scheduled|unread|critical|dropped/.test(t)) return <FiClock />;
  if (/approved|active|completed|verified|read|present|assisted|published/.test(t)) return <FiCheckCircle />;
  if (/date|meeting|exam|month/.test(t)) return <FiCalendar />;
  return <FiBarChart2 />;
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const w = 86;
  const h = 34;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const pts = data.map((d, i) => [2 + (i * (w - 4)) / (data.length - 1), h - 4 - ((d - min) / span) * (h - 10)]);
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  const area = `${line} V${h} H${pts[0][0].toFixed(1)}Z`;
  return (
    <svg width="72" height="30" viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="flex-shrink-0 text-primary-600 dark:text-brand-lime">
      <path d={area} fill="#8EC13E" opacity=".2" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function StatCard({
  title,
  value,
  icon,
  trend,
  onClick,
  className,
  tone = 'green',
  variant = 'tile',
  pills,
  sparkline,
  progress,
  viz,
  summary,
}: StatCardProps) {
  const interactive = Boolean(onClick);
  const compact = variant === 'inline';
  const label =
    summary ??
    [typeof value === 'string' || typeof value === 'number' ? `${title}: ${value}` : title, ...(pills ?? []), trend ? `${trend.isPositive ? '+' : '-'}${Math.abs(trend.value)}%${trend.suffix ? ` ${trend.suffix}` : ''}` : ''].filter(Boolean).join(', ');
  const a11y = interactive
    ? {
        role: 'button' as const,
        tabIndex: 0,
        onKeyDown: (e: React.KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.();
          }
        },
        'aria-label': label,
      }
    : viz
      ? { role: 'group' as const, 'aria-label': label }
      : {};

  return (
    <Card
      tint
      padding="none"
      className={cn(FRAME, compact ? 'px-3.5 py-3' : 'px-4 py-3.5', interactive && 'cursor-pointer', className)}
      onClick={onClick}
      hoverEffect={interactive}
      {...a11y}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 break-words text-[12px] font-bold uppercase leading-tight tracking-[0.03em] text-[#6A7771] line-clamp-2 sm:line-clamp-none sm:truncate dark:text-surface-muted">{title}</span>
        {(icon ?? defaultIcon(title)) && (
          <span
            className={cn(
              'flex flex-shrink-0 items-center justify-center rounded-[9px]',
              compact ? 'h-6 w-6 [&>svg]:h-[13px] [&>svg]:w-[13px]' : 'h-7 w-7 [&>svg]:h-[15px] [&>svg]:w-[15px]',
              CHIP[tone]
            )}
          >
            {icon ?? defaultIcon(title)}
          </span>
        )}
      </div>
      <div className={cn('flex items-end justify-between gap-2', compact ? 'mt-1' : 'mt-1.5')}>
        <div className="min-w-0">
          <div className={cn('truncate font-extrabold leading-none tracking-[-0.02em] text-primary-700 dark:text-surface-text', compact ? 'text-xl' : 'text-[28px]')}>{value}</div>
          {trend && (
            <span
              className={cn(
                'mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-bold',
                trend.isPositive
                  ? 'bg-mint text-primary-600 dark:bg-brand-lime/15 dark:text-brand-lime'
                  : 'bg-[#FDECEA] text-[#B3261E] dark:bg-red-500/15 dark:text-red-300'
              )}
            >
              {trend.isPositive ? <FiTrendingUp className="h-3 w-3" aria-hidden="true" /> : <FiTrendingDown className="h-3 w-3" aria-hidden="true" />}
              {trend.isPositive ? '+' : '-'}
              {Math.abs(trend.value)}%{trend.suffix ? ` ${trend.suffix}` : ''}
            </span>
          )}
          {pills && pills.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {pills.map((p) => (
                <span key={p} className="rounded-full bg-[#EEF3F0] px-2 py-0.5 text-[12px] font-bold text-[#4A5A52] dark:bg-surface-raised dark:text-surface-muted">
                  {p}
                </span>
              ))}
            </div>
          )}
        </div>
        {viz ? <StatVizGraphic viz={viz} scale={compact ? 0.85 : 1} /> : sparkline ? <Sparkline data={sparkline} /> : null}
      </div>
      {progress && (
        <div className="mt-2">
          <div className="h-1.5 rounded-md bg-[#E7EEEA] dark:bg-surface-raised">
            <div className="h-full rounded-md bg-progress-brand" style={{ width: `${Math.max(0, Math.min(100, progress.value))}%` }} />
          </div>
          {progress.caption && <div className="mt-1 text-[12px] text-[#6A7771] dark:text-surface-muted">{progress.caption}</div>}
        </div>
      )}
    </Card>
  );
}
