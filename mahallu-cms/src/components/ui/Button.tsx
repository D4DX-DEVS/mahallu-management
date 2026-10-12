import { ButtonHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = gradient green, secondary/outline = white + border, soft = mint tint, ghost = text-only, danger = soft red, accent = gold (use sparingly) */
  variant?: 'primary' | 'secondary' | 'outline' | 'soft' | 'ghost' | 'danger' | 'danger-solid' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  /** Square icon-only button; remember to pass aria-label. */
  iconOnly?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, iconOnly, children, disabled, type, ...props }, ref) => {
    const baseStyles =
      'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[10px] font-bold transition-all duration-150 ' +
      'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] ' +
      'disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]';

    const variants = {
      primary:
        'border-0 bg-btn-primary text-white shadow-btn hover:brightness-110 ' +
        'dark:bg-none dark:bg-brand-lime dark:text-primary-950 dark:shadow-none dark:hover:bg-brand-lime-bright dark:hover:brightness-100',
      secondary:
        'border border-line-strong bg-white font-semibold text-[#18231E] hover:bg-[#F4F7F5] ' +
        'dark:border-surface-border-strong dark:bg-surface-raised dark:text-surface-text dark:hover:bg-surface-hover',
      outline:
        'border border-line-strong bg-white font-semibold text-[#18231E] hover:bg-[#F4F7F5] ' +
        'dark:border-surface-border-strong dark:bg-surface-raised dark:text-surface-text dark:hover:bg-surface-hover',
      soft:
        'bg-mint text-primary-700 hover:bg-[#DCEBE3] dark:bg-brand-lime/15 dark:text-brand-lime dark:hover:bg-brand-lime/25',
      ghost:
        'bg-transparent text-primary-600 hover:bg-mint dark:text-brand-lime dark:hover:bg-surface-hover',
      danger:
        'bg-[#FDECEA] text-[#B3261E] hover:bg-[#FADAD6] dark:bg-red-500/15 dark:text-red-300 dark:hover:bg-red-500/25',
      'danger-solid':
        'bg-[#C53030] text-white shadow-sm hover:bg-[#A82525] dark:bg-red-600 dark:hover:bg-red-500',
      accent:
        'bg-secondary-500 text-[#18231E] hover:bg-secondary-400',
    };

    const sizes = {
      sm: iconOnly ? 'h-7 w-7 text-[12px] max-sm:h-9 max-sm:w-9' : 'h-7 px-3 text-[12px] rounded-lg max-sm:h-9',
      md: iconOnly ? 'h-[34px] w-[34px] text-[12.5px] max-sm:h-11 max-sm:w-11' : 'h-[34px] px-4 text-[12.5px] max-sm:h-11',
      lg: iconOnly ? 'h-10 w-10 text-sm max-sm:h-11 max-sm:w-11' : 'h-10 px-6 text-sm max-sm:h-11',
    };

    return (
      <button
        ref={ref}
        type={type}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading ? (
          <>
            <svg className="-ml-0.5 h-3.5 w-3.5 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Loading...
          </>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
