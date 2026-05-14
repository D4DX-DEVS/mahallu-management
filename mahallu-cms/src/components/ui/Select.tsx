import { SelectHTMLAttributes, forwardRef, useState, useRef, useEffect } from 'react';
import { FiChevronDown, FiSearch, FiX, FiPlus } from 'react-icons/fi';
import { cn } from '@/utils/cn';

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  options: { value: string; label: string }[];
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onAddNew?: () => void;
  addNewLabel?: string;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, helperText, options = [], value, onChange, disabled, onAddNew, addNewLabel = 'Add New', ...props }, ref) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [internalValue, setInternalValue] = useState(value || '');
    const dropdownRef = useRef<HTMLDivElement>(null);
    const selectRef = useRef<HTMLSelectElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Sync internalValue with value prop
    useEffect(() => {
      if (value !== undefined) {
        setInternalValue(value);
      }
    }, [value]);

    // Sync internalValue with native select element on mount
    useEffect(() => {
      if (selectRef.current?.value) {
        setInternalValue(selectRef.current.value);
      }
    }, []);

    // Determine if we need search (more than 10 options)
    const needsSearch = options.length > 10;
    const showSearch = needsSearch && isOpen;

    // Filter options based on search query
    const filteredOptions = showSearch
      ? options.filter((option) =>
          option.label.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : options;

    // Get selected option label using internalValue
    const selectedOption = options.find((opt) => opt.value === internalValue);
    const displayValue = selectedOption?.label || (internalValue === '' ? '' : internalValue);

    // Close dropdown when clicking outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
          setSearchQuery('');
          setFocusedIndex(-1);
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
        // Focus search input when dropdown opens
        if (showSearch && searchInputRef.current) {
          setTimeout(() => searchInputRef.current?.focus(), 0);
        }
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }, [isOpen, showSearch]);

    // Handle keyboard navigation
    useEffect(() => {
      if (!isOpen) return;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setIsOpen(false);
          setSearchQuery('');
          setFocusedIndex(-1);
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setFocusedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setFocusedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        } else if (e.key === 'Enter' && focusedIndex >= 0) {
          e.preventDefault();
          const option = filteredOptions[focusedIndex];
          if (option && selectRef.current) {
            setInternalValue(option.value);
            selectRef.current.value = option.value;
            selectRef.current.dispatchEvent(new Event('change', { bubbles: true }));
            setIsOpen(false);
            setSearchQuery('');
            setFocusedIndex(-1);
          }
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredOptions, focusedIndex]);

    const handleSelect = (optionValue: string) => {
      setInternalValue(optionValue);
      if (selectRef.current) {
        selectRef.current.value = optionValue;
        const event = new Event('change', { bubbles: true });
        selectRef.current.dispatchEvent(event);
      }
      setIsOpen(false);
      setSearchQuery('');
      setFocusedIndex(-1);
    };

    const handleToggle = () => {
      if (!disabled) {
        setIsOpen(!isOpen);
        if (!isOpen) {
          setSearchQuery('');
          setFocusedIndex(-1);
        }
      }
    };

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative" ref={dropdownRef}>
          {/* Hidden native select for form integration */}
          <select
            ref={(node) => {
              if (typeof ref === 'function') {
                ref(node);
              } else if (ref) {
                ref.current = node;
              }
              selectRef.current = node;
            }}
            value={internalValue}
            onChange={(e) => {
              setInternalValue(e.target.value);
              onChange?.(e);
            }}
            className="sr-only"
            disabled={disabled}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* Custom dropdown button */}
          <button
            type="button"
            onClick={handleToggle}
            disabled={disabled}
            className={cn(
              'flex h-11 w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-sm transition-all duration-200',
              'ring-offset-white placeholder:text-gray-400',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/20 focus-visible:border-primary-500',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-gray-50',
              'hover:border-gray-300 dark:hover:border-gray-600',
              'dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-100 dark:ring-offset-gray-950',
              'dark:placeholder:text-gray-500 dark:focus-visible:ring-primary-500/20 dark:focus-visible:border-primary-500',
              error && 'border-red-500 focus-visible:ring-red-500/20 focus-visible:border-red-500',
              isOpen && 'ring-2 ring-primary-500/20 border-primary-500',
              className
            )}
          >
            <span className={cn('truncate text-left', !displayValue && 'text-gray-400 dark:text-gray-500')}>
              {displayValue || props.placeholder || 'Select an option...'}
            </span>
            <FiChevronDown
              className={cn(
                'h-4 w-4 flex-shrink-0 text-gray-400 transition-transform duration-200',
                isOpen && 'rotate-180',
                disabled && 'opacity-50'
              )}
            />
          </button>

          {/* Dropdown menu */}
          {isOpen && (
            <div className="absolute z-50 mt-1 w-full rounded-xl border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-900 max-h-80 overflow-hidden">
              {/* Search input */}
              {showSearch && (
                <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchQuery}
                      onChange={(e) => {
                        setSearchQuery(e.target.value);
                        setFocusedIndex(-1);
                      }}
                      placeholder="Search..."
                      className="w-full h-9 pl-9 pr-8 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          searchInputRef.current?.focus();
                        }}
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <FiX className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Options list */}
              <div className="max-h-60 overflow-y-auto">
                {filteredOptions.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                    No options found
                  </div>
                ) : (
                  filteredOptions.map((option, index) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSelect(option.value)}
                      className={cn(
                        'w-full px-3.5 py-2.5 text-left text-sm transition-colors duration-150',
                        'hover:bg-gray-50 dark:hover:bg-gray-800',
                        internalValue === option.value && 'bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-400',
                        index === focusedIndex && 'bg-gray-50 dark:bg-gray-800',
                        index === 0 && 'rounded-t-lg',
                        index === filteredOptions.length - 1 && !onAddNew && 'rounded-b-lg'
                      )}
                      onMouseEnter={() => setFocusedIndex(index)}
                    >
                      {option.label}
                    </button>
                  ))
                )}
              </div>

              {onAddNew && (
                <div className="border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsOpen(false);
                      setSearchQuery('');
                      setFocusedIndex(-1);
                      onAddNew();
                    }}
                    className="w-full px-3.5 py-2.5 text-left text-sm text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 flex items-center gap-2 rounded-b-xl"
                  >
                    <FiPlus className="h-4 w-4 flex-shrink-0" />
                    {addNewLabel}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
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

Select.displayName = 'Select';

export default Select;
