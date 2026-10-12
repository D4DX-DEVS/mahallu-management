import { cn } from '@/utils/cn';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function LoadingSpinner({ size = 'md', className }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4 border-2',
    md: 'h-7 w-7 border-[3px]',
    lg: 'h-10 w-10 border-[3px]',
  };

  return (
    <div className={cn('flex items-center justify-center', className)} role="status" aria-label="Loading">
      <div
        className={cn(
          'animate-spin rounded-full border-mint-deep border-t-primary-600 dark:border-surface-border-strong dark:border-t-brand-lime',
          sizeClasses[size]
        )}
      />
    </div>
  );
}
