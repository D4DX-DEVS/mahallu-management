import * as React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { FiCheck, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { cn } from '@/utils/cn';

export interface AppSelectOption {
  value: string;
  label: string;
}

export interface AppSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: AppSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  label?: string;
  error?: string;
  helperText?: string;
  required?: boolean;
}

const AppSelect = React.forwardRef<HTMLButtonElement, AppSelectProps>(
  (
    {
      value,
      onChange,
      options,
      placeholder = 'Select an option',
      disabled = false,
      label,
      error,
      helperText,
      required,
    },
    ref
  ) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
            {label}
            {required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <SelectPrimitive.Root value={value} onValueChange={onChange} disabled={disabled}>
          <SelectPrimitive.Trigger
            ref={ref}
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
          >
            <SelectPrimitive.Value placeholder={placeholder} />
            <SelectPrimitive.Icon asChild>
              <FiChevronDown className="h-4 w-4 opacity-50" />
            </SelectPrimitive.Icon>
          </SelectPrimitive.Trigger>

          <SelectPrimitive.Portal>
            <SelectPrimitive.Content
              className={cn(
                'relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900',
                '         '
              )}
              position="popper"
              sideOffset={8}
            >
              <SelectPrimitive.ScrollUpButton className="flex cursor-pointer items-center justify-center py-1">
                <FiChevronUp className="h-4 w-4" />
              </SelectPrimitive.ScrollUpButton>

              <SelectPrimitive.Viewport className="p-1">
                <SelectPrimitive.Group>
                  {options.map((option) => (
                    <SelectPrimitive.Item
                      key={option.value}
                      value={option.value}
                      className={cn(
                        'relative flex w-full cursor-pointer select-none items-center rounded-md py-1.5 pl-8 pr-2 text-sm outline-none',
                        'focus:bg-primary-50 data-[disabled]:pointer-events-none data-[disabled]:opacity-50',
                        'dark:focus:bg-primary-900/20',
                        'hover:bg-gray-50 dark:hover:bg-gray-800'
                      )}
                    >
                      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
                        <SelectPrimitive.ItemIndicator>
                          <FiCheck className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                        </SelectPrimitive.ItemIndicator>
                      </span>

                      <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                    </SelectPrimitive.Item>
                  ))}
                </SelectPrimitive.Group>
              </SelectPrimitive.Viewport>

              <SelectPrimitive.ScrollDownButton className="flex cursor-pointer items-center justify-center py-1">
                <FiChevronDown className="h-4 w-4" />
              </SelectPrimitive.ScrollDownButton>
            </SelectPrimitive.Content>
          </SelectPrimitive.Portal>
        </SelectPrimitive.Root>

        {error && (
          <p className="mt-1.5 ml-1 text-sm text-red-600 dark:text-red-400    duration-200">{error}</p>
        )}
        {helperText && !error && (
          <p className="mt-1.5 ml-1 text-sm text-gray-500 dark:text-gray-400">{helperText}</p>
        )}
      </div>
    );
  }
);

AppSelect.displayName = 'AppSelect';

export default AppSelect;
