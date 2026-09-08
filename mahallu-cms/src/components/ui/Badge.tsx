import { HTMLAttributes } from 'react';
import { cn } from '@/utils/cn';
export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  /*
   *
   * `primary` is the brand tone. `success`/`warning`/`danger`/`info` are the
   * four semantic tokens. For record state use StatusBadge instead — it owns
   * the product's status vocabulary.
   */
  variant?: 'primary' | 'neutral' | 'secondary' | 'outline' | 'success' | 'warning' | 'danger' | 'info';
  size?: 'sm' | 'md';
}
export default function Badge({
  className,
  variant = 'neutral',
  size = 'sm',
  children,
  ...props
}: BadgeProps) {
  const variants = {
    primary: 'bg-primary/10 text-primary ring-primary/25',
    neutral: 'bg-muted text-muted-foreground ring-border',
    /*
     * Alias of neutral, kept for existing call sites. */
    secondary: 'bg-muted text-muted-foreground ring-border',
    outline: 'bg-transparent text-foreground ring-border',
    success: 'bg-success/10 text-success ring-success/25',
    warning: 'bg-warning/10 text-warning ring-warning/25',
    danger: 'bg-destructive/10 text-destructive ring-destructive/25',
    info: 'bg-info/10 text-info ring-info/25',
  };
  const sizes = { sm: 'px-2 py-0.5 text-xs', md: 'px-2.5 py-1 text-sm' };
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-sm font-medium ring-1 ring-inset',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
