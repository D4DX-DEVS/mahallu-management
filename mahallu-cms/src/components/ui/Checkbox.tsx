import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            ref={ref}
            className={cn(
              'h-4 w-4 cursor-pointer rounded border-line-strong accent-primary-700 dark:accent-brand-lime',
              'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28]',
              error && 'border-[#D9534F]',
              className
            )}
            {...props}
          />
          {label && (
            <span className="text-[13px] font-semibold text-[#3A4741] dark:text-surface-text">{label}</span>
          )}
        </label>
        {error && <p className="mt-1 text-[12px] font-medium text-[#B3261E] dark:text-red-300">{error}</p>}
      </div>
    );
  }
);

Checkbox.displayName = 'Checkbox';

export default Checkbox;
