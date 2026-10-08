import { InputHTMLAttributes, forwardRef, ReactNode } from 'react';
import { cn } from '@/utils/cn';
import Field, { useFieldIds } from './Field';
export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: ReactNode;
} /** Shared control surface — Input, Select trigger and DatePicker all use it. */
/* Soft outlined field: light hairline and a whisper of shadow at rest, a
 * darker line on hover, and a brand-coloured edge with a soft 4px halo on
 * focus — the field you are in is unmistakable without a hard outline. */
export const controlClasses =
  'flex h-10 w-full rounded-lg border border-input/40 bg-card px-3 text-sm text-foreground shadow-sm ' +
  'transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-muted-foreground/80 ' +
  'hover:border-input/70 ' +
  'focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 ' +
  'aria-expanded:border-primary aria-expanded:ring-4 aria-expanded:ring-primary/10 ' +
  'disabled:cursor-not-allowed disabled:bg-subtle disabled:opacity-60 disabled:shadow-none ' +
  'aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive/10';
const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, icon, type = 'text', id, required, ...props }, ref) => {
    const ids = useFieldIds({ id, error, helperText, required });
    return (
      <Field ids={ids} label={label} error={error} helperText={helperText} required={required}>
        <div className="relative">
          {icon && (
            <span
              className="pointer-events-none absolute left-3 top-1/2 flex -translate-y-1/2 text-muted-foreground [&>svg]:h-4 [&>svg]:w-4"
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
