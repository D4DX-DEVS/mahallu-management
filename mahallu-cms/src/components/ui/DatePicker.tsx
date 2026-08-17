import * as React from 'react';
import { format, parse } from 'date-fns';
import { FiCalendar } from 'react-icons/fi';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { cn } from '@/utils/cn';

export interface DatePickerProps {
  value: string; // Expected format: 'YYYY-MM-DD'
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  minDate?: Date;
  maxDate?: Date;
}

const DatePicker = React.forwardRef<HTMLButtonElement, DatePickerProps>(
  (
    {
      value,
      onChange,
      placeholder = 'Pick a date',
      disabled = false,
      label,
      error,
      helperText,
      required,
      minDate,
      maxDate,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);

    // Parse the value string to Date
    const selectedDate = value ? parse(value, 'yyyy-MM-dd', new Date()) : undefined;

    const handleDateChange = (date: Date | undefined) => {
      if (date) {
        const formatted = format(date, 'yyyy-MM-dd');
        onChange(formatted);
      }
      setIsOpen(false);
    };

    const displayValue = selectedDate ? format(selectedDate, 'PPP') : '';

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}

        <PopoverPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
          <PopoverPrimitive.Trigger asChild>
            <button
              ref={ref}
              disabled={disabled}
              className={cn(
                'flex h-11 w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm transition-all duration-200',
                'ring-offset-white placeholder:text-gray-400',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/20 focus-visible:border-primary-500',
                'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50',
                'hover:border-gray-300 dark:hover:border-gray-600',
                'dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-100 dark:ring-offset-gray-950',
                'dark:placeholder:text-gray-500 dark:focus-visible:ring-primary-500/20 dark:focus-visible:border-primary-500',
                error && 'border-red-500 focus-visible:ring-red-500/20 focus-visible:border-red-500'
              )}
              type="button"
            >
              <span className={cn('text-left', !displayValue && 'text-gray-400 dark:text-gray-500')}>
                {displayValue || placeholder}
              </span>
              <FiCalendar className="h-4 w-4 opacity-50 flex-shrink-0" />
            </button>
          </PopoverPrimitive.Trigger>

          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              className="z-50 rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900 p-3"
              align="start"
              sideOffset={8}
            >
              <style>{`
                .rdp {
                  --rdp-cell-size: 40px;
                  --rdp-accent-color: #3b82f6;
                  --rdp-background-color: #3b82f6;
                  --rdp-cell-border-radius: 8px;
                }
                .rdp-day_selected:not([disabled]) {
                  background-color: #3b82f6;
                  color: white;
                }
                .rdp-day_today:not([disabled]) {
                  font-weight: bold;
                  color: #3b82f6;
                }
                .rdp-day:hover:not([disabled]) {
                  background-color: #f0f4f8;
                }
                .dark .rdp-day:hover:not([disabled]) {
                  background-color: #1e293b;
                }
                .rdp-head_cell {
                  color: #6b7280;
                  font-weight: 600;
                  text-transform: uppercase;
                  font-size: 0.75rem;
                }
                .dark .rdp-head_cell {
                  color: #9ca3af;
                }
                .rdp-caption {
                  color: #111827;
                  margin-bottom: 1rem;
                }
                .dark .rdp-caption {
                  color: #f3f4f6;
                }
              `}</style>
              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={handleDateChange}
                disabled={(date) => {
                  if (minDate && date < minDate) return true;
                  if (maxDate && date > maxDate) return true;
                  return false;
                }}
              />
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>

        {error && (
          <p className="mt-1.5 ml-1 text-sm text-red-600 dark:text-red-400 animate-in slide-in-from-top-1 fade-in duration-200">
            {error}
          </p>
        )}
        {helperText && !error && (
          <p className="mt-1.5 ml-1 text-sm text-gray-500 dark:text-gray-400">{helperText}</p>
        )}
      </div>
    );
  }
);

DatePicker.displayName = 'DatePicker';

export default DatePicker;
