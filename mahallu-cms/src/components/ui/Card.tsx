import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hoverEffect?: boolean;
  /** Subtle mint gradient used by KPI tiles */
  tint?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding = 'md', hoverEffect = false, tint = false, children, ...props }, ref) => {
    const paddingClasses = {
      none: '',
      sm: 'p-3',
      md: 'p-4',
      lg: 'p-[18px]',
    };

    return (
      <div
        ref={ref}
        className={cn(
          'rounded-card border border-line bg-white shadow-card transition-[box-shadow,transform] duration-200',
          'dark:border-surface-border dark:bg-surface-card dark:shadow-none',
          tint && 'bg-gradient-to-b from-white to-[#F6FAF7] dark:from-surface-card dark:to-surface-card',
          hoverEffect && 'hover:-translate-y-px hover:shadow-card-hover',
          paddingClasses[padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;
