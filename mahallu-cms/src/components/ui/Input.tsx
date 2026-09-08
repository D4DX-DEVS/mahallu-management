import { InputHTMLAttributes, forwardRef, ReactNode } from 'react';
import { cn } from '@/utils/cn';
import Field, { useFieldIds } from './Field';
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: ReactNode;
} /** Shared control surface — Input, Select trigger and DatePicker all use it. */
export const controlClasses =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground ' +
  'transition-colors placeholder:text-muted-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
  'focus-visible:ring-offset-background ' +
  'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted ' +
  'aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive';
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, icon, type = 'text', id, required, ...props }, ref) => {
    const ids = useFieldIds({ id, error, helperText, required });
    return (
      <Field ids={ids} label={label} error={error} helperText={helperText} required={required}>
        <div className="relative">
          {icon && (
            <span
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            >
              {icon}
            </span>
          )}
          <input
            type={type}
            ref={ref}
            required={required}
            className={cn(controlClasses, icon && 'pl-10', className)}
            {...ids.controlProps}
            {...props}
          />
        </div>
      </Field>
    );
  }
);
Input.displayName = 'Input';

export default Input;
