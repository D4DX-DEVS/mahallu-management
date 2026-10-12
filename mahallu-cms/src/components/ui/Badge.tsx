import { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'solid';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: 'sm' | 'md' | 'lg';
  /** Show the coloured status dot (recommended for statuses) */
  dot?: boolean;
}

const VARIANTS: Record<BadgeVariant, { wrap: string; dot: string }> = {
  primary: { wrap: 'bg-mint text-primary-600 dark:bg-brand-lime/15 dark:text-brand-lime', dot: 'bg-[#1E9B63] dark:bg-brand-lime' },
  success: { wrap: 'bg-mint text-primary-600 dark:bg-brand-lime/15 dark:text-brand-lime', dot: 'bg-[#1E9B63] dark:bg-brand-lime' },
  warning: { wrap: 'bg-[#FFF6CC] text-[#7A5B00] dark:bg-secondary-500/15 dark:text-secondary-300', dot: 'bg-[#E0B400] dark:bg-secondary-500' },
  danger: { wrap: 'bg-[#FDECEA] text-[#B3261E] dark:bg-red-500/15 dark:text-red-300', dot: 'bg-[#D9534F] dark:bg-red-400' },
  info: { wrap: 'bg-[#EAF1FB] text-[#1F4E8C] dark:bg-blue-400/15 dark:text-blue-300', dot: 'bg-[#3B7DD8] dark:bg-blue-400' },
  secondary: { wrap: 'bg-[#EEF3F0] text-[#5B6963] dark:bg-surface-raised dark:text-surface-muted', dot: 'bg-[#98A59F]' },
  neutral: { wrap: 'bg-[#EEF3F0] text-[#5B6963] dark:bg-surface-raised dark:text-surface-muted', dot: 'bg-[#98A59F]' },
  solid: { wrap: 'bg-primary-700 text-white dark:bg-brand-lime dark:text-primary-950', dot: 'bg-white/80' },
};

export default function Badge({
  className,
  variant = 'primary',
  size = 'md',
  dot = false,
  children,
  ...props
}: BadgeProps) {
  const sizes = {
    sm: 'px-2 py-px text-[12px] gap-1',
    md: 'px-2.5 py-[3px] text-[12px] gap-1.5',
    lg: 'px-3 py-1 text-xs gap-1.5',
  };
  const v = VARIANTS[variant];

  return (
    <span
      className={cn('inline-flex items-center rounded-full font-bold leading-4', v.wrap, sizes[size], className)}
      {...props}
    >
      {dot && <i aria-hidden="true" className={cn('inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full', v.dot)} />}
      {children}
    </span>
  );
}
