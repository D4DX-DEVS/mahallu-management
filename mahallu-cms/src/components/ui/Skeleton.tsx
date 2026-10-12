import { cn } from '@/utils/cn';

/** Pulse placeholder block: <Skeleton className="h-4 w-32" /> */
export default function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-lg bg-[#E7EEEA] dark:bg-surface-raised', className)} />;
}
