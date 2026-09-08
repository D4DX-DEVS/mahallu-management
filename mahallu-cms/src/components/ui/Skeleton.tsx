import { cn } from '@/utils/cn';

interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-gray-200/70 dark:bg-gray-700/50',
        'after:absolute after:inset-0 after:-translate-x-full after:animate-shimmer',
        'after:bg-gradient-to-r after:from-transparent after:via-white/60 after:to-transparent',
        'dark:after:via-white/10',
        className
      )}
    />
  );
}

interface PageSkeletonProps {
  /** 'page' fills a whole route (header + stats + card); 'section' fills a panel inside a card. */
  variant?: 'page' | 'section';
}

export function PageSkeleton({ variant = 'page' }: PageSkeletonProps) {
  if (variant === 'section') {
    return (
      <div className="py-2">
        <TableSkeleton columns={4} rows={6} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-6 w-56 max-w-full" />
        <Skeleton className="h-3.5 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
        <TableSkeleton columns={4} rows={7} />
      </div>
    </div>
  );
}

interface TableSkeletonProps {
  columns: number;
  rows?: number;
}

export function TableSkeleton({ columns, rows = 8 }: TableSkeletonProps) {
  return (
    <div className="divide-y divide-gray-200 dark:divide-gray-700">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-3 px-3 py-3">
          {Array.from({ length: columns }).map((_, c) => (
            // ponytail: even-width bars, not measured against real column widths
            <Skeleton key={c} className={cn('h-3.5 flex-1', c === 0 && 'max-w-[40%]')} />
          ))}
        </div>
      ))}
    </div>
  );
}
