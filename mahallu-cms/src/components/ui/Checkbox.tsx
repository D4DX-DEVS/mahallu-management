import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';
import { useFieldIds } from './Field';
export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: string;
  error?: string;
  helperText?: string;
} /** * The box is 20px inside a 44px-tall hit area, clearing the minimum target * size. Raw `<input type="checkbox">` at ~16px with no focus ring was used in * 25 places; those are being migrated onto this. */
const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, error, helperText, id, ...props }, ref) => {
    const ids = useFieldIds({ id, error, helperText });
    return (
      <div className="w-full">
        <div className="flex min-h-11 items-center gap-2.5">
          <input
            type="checkbox"
            ref={ref}
            className={cn(
              'h-5 w-5 flex-shrink-0 cursor-pointer rounded-sm border-input accent-primary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-destructive',
              className
            )}
            {...ids.controlProps}
            {...props}
          />
          {label && (
            <label htmlFor={ids.id} className="cursor-pointer select-none text-sm text-foreground">
              {label}
            </label>
          )}
        </div>
        {error && (
          <p id={ids.errorId} className="text-label text-destructive">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p id={ids.helperId} className="text-label text-muted-foreground">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);
Checkbox.displayName = 'Checkbox';

export default Checkbox;
