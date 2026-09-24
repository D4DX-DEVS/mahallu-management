import * as React from 'react';
import { format, parse } from 'date-fns';
import { FiCalendar } from 'react-icons/fi';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { cn } from '@/utils/cn';
import Field, { useFieldIds } from './Field';
import { controlClasses } from './Input';
export interface DatePickerProps {
  /** Expected format: 'YYYY-MM-DD' */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
  minDate?: Date;
  maxDate?: Date;
  /** 'dropdown' swaps the month/year caption for pickers — useful for far-back dates like a birth date. */
  captionLayout?: 'label' | 'dropdown' | 'dropdown-months' | 'dropdown-years';
  /** Bounds the dropdown caption's year range. Defaults to minDate/maxDate. */
  startMonth?: Date;
  endMonth?: Date;
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
      captionLayout,
      startMonth,
      endMonth,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const ids = useFieldIds({ error, helperText, required });

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
      <Field ids={ids} label={label} error={error} helperText={helperText} required={required}>
        <PopoverPrimitive.Root open={isOpen} onOpenChange={setIsOpen}>
          <PopoverPrimitive.Trigger asChild>
            <button
              ref={ref}
              disabled={disabled}
              className={cn(controlClasses, 'items-center justify-between text-left')}
              {...ids.controlProps}
              type="button"
            >
              <span className={cn('truncate', !displayValue && 'text-muted-foreground')}>
                {displayValue || placeholder}
              </span>
              <FiCalendar className="ml-2 h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
          </PopoverPrimitive.Trigger>
          <PopoverPrimitive.Portal>
            <PopoverPrimitive.Content
              className="z-[100] max-w-[calc(100vw-16px)] rounded-lg border border-border bg-popover p-2 text-popover-foreground shadow-md sm:p-3"
              align="start"
              sideOffset={8}
              collisionPadding={8}
            >
              <style>{` .rdp { --rdp-cell-size: 36px; } @media (min-width: 640px) { .rdp { --rdp-cell-size: 40px; } } .rdp { --rdp-accent-color: hsl(var(--primary)); --rdp-background-color: hsl(var(--accent)); --rdp-cell-border-radius: var(--radius); } .rdp-day_selected:not([disabled]) { background-color: hsl(var(--primary)); color: hsl(var(--primary-foreground)); } .rdp-day_today:not([disabled]) { font-weight: 600; color: hsl(var(--primary)); } .rdp-day:hover:not([disabled]) { background-color: hsl(var(--accent)); } .rdp-head_cell { color: hsl(var(--muted-foreground)); font-weight: 500; font-size: 0.75rem; } .rdp-caption, .rdp-caption_label, .rdp-dropdown { color: hsl(var(--foreground)); } .rdp-dropdown option { background-color: hsl(var(--popover)); color: hsl(var(--popover-foreground)); } .rdp-nav_button:hover { background-color: hsl(var(--accent)); } `}</style>
              <DayPicker
                mode="single"
                selected={selectedDate}
                onSelect={handleDateChange}
                defaultMonth={selectedDate}
                captionLayout={captionLayout}
                startMonth={startMonth ?? minDate}
                endMonth={endMonth ?? maxDate}
                disabled={(date) => {
                  if (minDate && date < minDate) return true;
                  if (maxDate && date > maxDate) return true;
                  return false;
                }}
              />
            </PopoverPrimitive.Content>
          </PopoverPrimitive.Portal>
        </PopoverPrimitive.Root>
      </Field>
    );
  }
);
DatePicker.displayName = 'DatePicker';

export default DatePicker;
