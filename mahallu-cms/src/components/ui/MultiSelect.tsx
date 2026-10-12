import { useEffect, useMemo, useRef, useState } from 'react';
import FloatingPanel, { isInsideFloating } from './FloatingPanel';
import { FiChevronDown, FiSearch, FiX } from 'react-icons/fi';
import { cn } from '@/utils/cn';
import { controlClasses, controlErrorClasses, labelClasses } from './Input';

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectProps {
  label?: string;
  placeholder?: string;
  error?: string;
  helperText?: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  className?: string;
  showSelectAll?: boolean;
  selectAllLabel?: string;
}

export default function MultiSelect({
  label,
  placeholder = 'Select options...',
  error,
  helperText,
  options,
  value,
  onChange,
  disabled = false,
  className,
  showSelectAll = true,
  selectAllLabel = 'Select all',
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase();
    return options.filter((option) => option.label.toLowerCase().includes(query));
  }, [options, searchQuery]);

  const selectedLabels = useMemo(() => {
    const selectedSet = new Set(value);
    return options.filter((opt) => selectedSet.has(opt.value)).map((opt) => opt.label);
  }, [options, value]);

  const allOptionValues = useMemo(() => options.map((option) => option.value), [options]);
  const isAllSelected = allOptionValues.length > 0 && value.length === allOptionValues.length;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) && !isInsideFloating(event.target)) {
        setIsOpen(false);
        setSearchQuery('');
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((item) => item !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const handleToggleAll = () => {
    if (isAllSelected) {
      onChange([]);
    } else {
      onChange(allOptionValues);
    }
  };

  const displayValue =
    selectedLabels.length === 0
      ? placeholder
      : selectedLabels.length <= 2
        ? selectedLabels.join(', ')
        : `${selectedLabels.length} selected`;

  return (
    <div className="w-full">
      {label && (
        <label className={labelClasses}>
          {label}
        </label>
      )}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          disabled={disabled}
          className={cn(
            controlClasses,
              'flex h-9 items-center justify-between max-sm:h-11',
            error && controlErrorClasses,
            isOpen && 'border-primary-600 shadow-focus dark:border-brand-lime',
            className
          )}
        >
          <span className={cn('truncate text-left', selectedLabels.length === 0 && 'text-[#98A59F] dark:text-surface-muted')}>
            {displayValue}
          </span>
          <FiChevronDown
            className={cn(
              'h-4 w-4 flex-shrink-0 text-gray-400 transition-transform duration-200',
              isOpen && 'rotate-180',
              disabled && 'opacity-50'
            )}
          />
        </button>

        {isOpen && (
          <FloatingPanel anchorRef={dropdownRef} className="rounded-xl border border-line bg-white shadow-pop dark:border-surface-border dark:bg-surface-raised">
            <div className="p-2 border-b border-gray-200 dark:border-gray-700">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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

            <div className="min-h-0 max-h-60 flex-1 overflow-y-auto overscroll-contain">
              {showSelectAll && (
                <button
                  type="button"
                  onClick={handleToggleAll}
                  className="w-full px-3.5 py-2.5 text-left text-sm transition-colors duration-150 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800"
                >
                  <span className="inline-flex items-center gap-2">
                    <input type="checkbox" readOnly checked={isAllSelected} />
                    {isAllSelected ? 'Clear all' : selectAllLabel}
                  </span>
                </button>
              )}

              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                  No options found
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const checked = value.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleOption(option.value)}
                      className={cn(
                        'w-full px-3.5 py-2.5 text-left text-sm transition-colors duration-150',
                        'hover:bg-gray-50 dark:hover:bg-gray-800',
                        checked && 'bg-mint font-bold text-primary-700 dark:bg-brand-lime/15 dark:text-brand-lime'
                      )}
                    >
                      <span className="inline-flex items-center gap-2">
                        <input type="checkbox" readOnly checked={checked} />
                        {option.label}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </FloatingPanel>
        )}
      </div>
      {error && (
        <p className="mt-1.5 text-[12px] font-medium text-[#B3261E] dark:text-red-300">
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="mt-1.5 text-[12px] text-[#7B8983] dark:text-surface-muted">{helperText}</p>
      )}
    </div>
  );
}
