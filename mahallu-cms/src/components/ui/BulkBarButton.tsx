import { ButtonHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

/** Compact button styled for the Table's selection bar (sits on the dark green strip). */
export default function BulkBarButton({ className, type = 'button', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex h-7 max-sm:h-10 items-center gap-1.5 rounded-lg bg-white/15 px-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-lime disabled:opacity-50 dark:bg-brand-lime/15 dark:text-brand-lime dark:hover:bg-brand-lime/25',
        className
      )}
      {...rest}
    />
  );
}
