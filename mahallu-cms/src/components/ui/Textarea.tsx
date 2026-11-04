import { TextareaHTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';
import Field, { useFieldIds } from './Field';
import { controlClasses } from './Input';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
  /** Classes for the whole field (label, control and message) - e.g. to span grid columns. */
  wrapperClassName?: string;
}

/**
 * A multi-line field with the same label, error and helper text as Input. Fixed height of `rows` lines
 * that the person can drag taller; long words wrap instead of widening the page.
 */
const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, wrapperClassName, label, error, helperText, id, required, rows = 3, ...props }, ref) => {
    const ids = useFieldIds({ id, error, helperText, required });
    return (
      <Field ids={ids} label={label} error={error} helperText={helperText} required={required} className={wrapperClassName}>
        <textarea
          ref={ref}
          rows={rows}
          required={required}
          className={cn(controlClasses, 'h-auto min-h-[5rem] resize-y whitespace-pre-wrap py-2 [overflow-wrap:anywhere]', className)}
          {...ids.controlProps}
          {...props}
        />
      </Field>
    );
  }
);
Textarea.displayName = 'Textarea';

export default Textarea;
