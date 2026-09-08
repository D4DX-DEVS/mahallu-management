import { ReactNode, useId } from 'react';
import { cn } from '@/utils/cn';
export interface FieldIds {
  id: string;
  errorId: string;
  helperId: string;
  /*
   * Spread onto the control. Binds label, error and helper text to it. */
  controlProps: {
    id: string;
    'aria-invalid': boolean | undefined;
    'aria-describedby': string | undefined;
    'aria-required': boolean | undefined;
  };
} /** * Supplies the ids that bind a label, its control, its error and its helper * text together. Every form control in the product must use this — without it * a label is decorative, clicking it does not focus the field, and a screen * reader announces an unnamed control with no error. */
export function useFieldIds(opts: {
  id?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}): FieldIds {
  const generated = useId();
  const id = opts.id ?? generated;
  const errorId = `${id}-error`;
  const helperId = `${id}-helper`;
  const describedBy = [opts.error ? errorId : null, opts.helperText && !opts.error ? helperId : null]
    .filter(Boolean)
    .join(' ');
  return {
    id,
    errorId,
    helperId,
    controlProps: {
      id,
      'aria-invalid': opts.error ? true : undefined,
      'aria-describedby': describedBy || undefined,
      'aria-required': opts.required || undefined,
    },
  };
}
export interface FieldProps {
  ids: FieldIds;
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  className?: string;
  /*
   * Optional control rendered at the right of the label row, e.g. "Add new". */
  labelAction?: ReactNode;
  children: ReactNode;
} /** Label + control + message, with one consistent vertical rhythm. */
export default function Field({
  ids,
  label,
  error,
  helperText,
  required,
  className,
  labelAction,
  children,
}: FieldProps) {
  return (
    <div className={cn('w-full', className)}>
      {label && (
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label htmlFor={ids.id} className="block text-label font-medium text-foreground">
            {label}
            {required && (
              <span className="ml-1 text-destructive" aria-hidden="true">
                *
              </span>
            )}
          </label>
          {labelAction}
        </div>
      )}
      {children}
      {error && (
        <p id={ids.errorId} className="mt-1.5 text-label text-destructive">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p id={ids.helperId} className="mt-1.5 text-label text-muted-foreground">
          {helperText}
        </p>
      )}
    </div>
  );
}
