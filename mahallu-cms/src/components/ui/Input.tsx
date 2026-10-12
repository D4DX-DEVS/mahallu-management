import { InputHTMLAttributes, forwardRef, ReactNode, useId } from 'react';
import { cn } from '@/utils/cn';
import DateInput from './DateInput';
import MonthPicker from './MonthPicker';
import TimeInput from './TimeInput';
import DateTimeInput from './DateTimeInput';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: ReactNode;
}

import { controlClasses, controlErrorClasses, labelClasses } from './controlStyles';
export { controlClasses, controlErrorClasses, labelClasses } from './controlStyles';

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, icon, type = 'text', id, ...props }, ref) => {
    const autoId = useId();
    const inputId = id ?? autoId;
    // native date/time controls are replaced by the ZAAD pickers (same ISO values, same ref/onChange contract)
    if (type === 'date' || type === 'month' || type === 'time' || type === 'datetime-local') {
      const { value, defaultValue, onChange, min, max, icon: _icon, ...other } = props as Record<string, unknown> & typeof props;
      const common = {
        ...(other as object), id, label, error, helperText, className,
        value: value as string | undefined,
        defaultValue: defaultValue as string | undefined,
        onChange: onChange as React.ChangeEventHandler<HTMLInputElement> | undefined,
        min: min as string | undefined,
        max: max as string | undefined,
      };
      const Picker = type === 'date' ? DateInput : type === 'month' ? MonthPicker : type === 'time' ? TimeInput : DateTimeInput;
      return <Picker {...(common as React.ComponentProps<typeof DateInput>)} ref={ref} />;
    }
    return (
      <div className="w-full">
        {label && (
          <label htmlFor={inputId} className={labelClasses}>
            {label}
            {props.required && <span className="ml-0.5 text-[#D9534F]">*</span>}
          </label>
        )}
        <div className="group relative">
          {icon && (
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7B8983] transition-colors duration-150 group-focus-within:text-primary-600 dark:group-focus-within:text-brand-lime">
              {icon}
            </div>
          )}
          <input
            id={inputId}
            type={type}
            ref={ref}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-hint` : undefined}
            className={cn(
              controlClasses,
              'flex h-9 max-sm:h-11 file:border-0 file:bg-transparent file:text-[13px] file:font-medium',
              error && controlErrorClasses,
              icon && 'pl-9',
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-[12px] font-medium text-[#B3261E] dark:text-red-300">{error}</p>
        )}
        {helperText && !error && (
          <p id={`${inputId}-hint`} className="mt-1.5 text-[12px] text-[#7B8983] dark:text-surface-muted">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
