import { ReactNode } from 'react';
import { FiArrowUp, FiArrowDown } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import { cn } from '@/utils/cn';

export type StatCardAccent =
  | 'slate'
  | 'rose'
  | 'violet'
  | 'emerald'
  | 'amber'
  | 'indigo'
  | 'lime'
  | 'orange'
  | 'red';

export interface DashboardStatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  accent?: StatCardAccent;
  trend?: { value: number; isPositive: boolean };
  onClick?: () => void;
}

const ACCENT_CLASSES: Record<StatCardAccent, string> = {
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  lime: 'bg-lime-50 text-lime-600 dark:bg-lime-900/30 dark:text-lime-400',
  orange: 'bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
  red: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
};

export default function DashboardStatCard({
  label,
  value,
  icon,
  accent = 'slate',
  trend,
  onClick,
}: DashboardStatCardProps) {
  return (
    <Card
      padding="sm"
      hoverEffect
      onClick={onClick}
      className={cn('flex h-full flex-col justify-between gap-3 sm:p-4', onClick && 'cursor-pointer')}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className={cn(
              'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
              ACCENT_CLASSES[accent]
            )}
          >
            {icon}
          </div>
          <p className="truncate text-xs font-medium text-gray-500 dark:text-gray-400">{label}</p>
        </div>
        {trend && (
          <span
            className={cn(
              'flex flex-shrink-0 items-center gap-0.5 text-xs font-semibold',
              trend.isPositive ? 'text-emerald-600' : 'text-red-500'
            )}
          >
            {trend.isPositive ? <FiArrowUp className="h-3 w-3" /> : <FiArrowDown className="h-3 w-3" />}
            {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-xl font-bold leading-none tracking-tight text-gray-900 dark:text-gray-100 sm:text-2xl">
          {value}
        </p>
        {trend && <p className="mt-1 text-[11px] text-gray-400 dark:text-gray-500">vs last month</p>}
      </div>
    </Card>
  );
}
