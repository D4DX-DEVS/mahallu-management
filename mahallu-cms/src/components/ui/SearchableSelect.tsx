import { forwardRef, useState, useRef, useEffect, useCallback } from 'react';
import FloatingPanel, { isInsideFloating } from './FloatingPanel';
import { FiSearch, FiX, FiChevronDown, FiLoader } from 'react-icons/fi';
import { cn } from '@/utils/cn';
import { controlClasses, controlErrorClasses, labelClasses } from './Input';

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

export interface SearchableSelectProps {
  label?: string;
  error?: string;
  helperText?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  /** Current selected value (option.value) */
  value?: string;
  /** Called when an option is selected or cleared */
  onChange?: (value: string) => void;
  /** Static options to show (client-side filtering) */
  options?: SearchableSelectOption[];
  /** Called when the search query changes (for server-side search) */
  onSearch?: (query: string) => void;
  /** Whether a search is in progress */
  isLoading?: boolean;
  /** Name attribute for form integration */
  name?: string;
}

const SearchableSelect = forwardRef<HTMLInputElement, SearchableSelectProps>(
  (
    {
      label,
      error,
      helperText,
      placeholder = 'Search and select...',
      required,
      disabled,
      className,
      value,
      onChange,
      options = [],
      onSearch,
      isLoading = false,
      name,
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [internalValue, setInternalValue] = useState(value || '');
    const containerRef = useRef<HTMLDivElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const hiddenInputRef = useRef<HTMLInputElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Sync internal value with external value prop
    useEffect(() => {
      if (value !== undefined) {
        setInternalValue(value);
      }
    }, [value]);

    // Get the selected option label for display
    const selectedOption = options.find((opt) => opt.value === internalValue);

    // Filter options client-side based on search query
    const filteredOptions = searchQuery
      ? options.filter(
          (opt) =>
            opt.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (opt.sublabel && opt.sublabel.toLowerCase().includes(searchQuery.toLowerCase()))
        )
      : options;

    // Debounced search handler for server-side search
    const handleSearchChange = useCallback(
      (query: string) => {
        setSearchQuery(query);
        setFocusedIndex(-1);

        if (onSearch) {
          if (debounceRef.current) clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            onSearch(query);
          }, 300);
        }
      },
      [onSearch]
    );

    // Clean up debounce on unmount
    useEffect(() => {
      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
      };
    }, []);

    // Handle option selection
    const handleSelect = (optionValue: string) => {
      setInternalValue(optionValue);
      setIsOpen(false);
      setSearchQuery('');
      setFocusedIndex(-1);
      onChange?.(optionValue);
    };

    // Handle clearing the selection
    const handleClear = (e: React.MouseEvent) => {
      e.stopPropagation();
      setInternalValue('');
      setSearchQuery('');
      onChange?.('');
      if (onSearch) onSearch('');
    };

    // Toggle dropdown
    const handleToggle = () => {
      if (disabled) return;
      const opening = !isOpen;
      setIsOpen(opening);
      if (opening) {
        setSearchQuery('');
        setFocusedIndex(-1);
        // Load initial results
        if (onSearch) onSearch('');
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
    };

    // Close on click outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node) && !isInsideFloating(event.target)) {
          setIsOpen(false);
          setSearchQuery('');
          setFocusedIndex(-1);
        }
      };

      if (isOpen) {
        document.addEventListener('mousedown', handleClickOutside);
      }
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    // Keyboard navigation
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
          if (option) handleSelect(option.value);
        }
      };

      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, filteredOptions, focusedIndex]);

    // Scroll focused option into view
    useEffect(() => {
      if (focusedIndex >= 0 && isOpen) {
        const el = document.querySelector(`[data-floating-panel] [data-index="${focusedIndex}"]`);
        el?.scrollIntoView({ block: 'nearest' });
      }
    }, [focusedIndex, isOpen]);

    return (
      <div className={cn('w-full', className)}>
        {label && (
          <label className={labelClasses}>
            {label}
            {required && <span className="ml-0.5 text-[#D9534F]">*</span>}
          </label>
        )}

        <div className="relative" ref={containerRef}>
          {/* Hidden input for form integration */}
          <input
            type="hidden"
            ref={(node) => {
              if (typeof ref === 'function') {
                ref(node);
              } else if (ref) {
                (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
              }
              hiddenInputRef.current = node;
            }}
            name={name}
            value={internalValue}
            readOnly
          />

          {/* Trigger button */}
          <button
            type="button"
            onClick={handleToggle}
            disabled={disabled}
            className={cn(
              controlClasses,
              'flex h-9 items-center justify-between max-sm:h-11',
              error && controlErrorClasses,
              isOpen && 'border-primary-600 shadow-focus dark:border-brand-lime'
            )}
          >
            <span className={cn('truncate text-left flex-1', !selectedOption && 'text-[#98A59F] dark:text-surface-muted')}>
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <div className="flex items-center gap-1 ml-2">
              {internalValue && !disabled && (
                <span
                  role="button"
                  tabIndex={-1}
                  onClick={handleClear}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5"
                >
                  <FiX className="h-3.5 w-3.5" />
                </span>
              )}
              <FiChevronDown
                className={cn(
                  'h-4 w-4 flex-shrink-0 text-gray-400 transition-transform duration-200',
                  isOpen && 'rotate-180'
                )}
              />
            </div>
          </button>

          {/* Dropdown */}
          {isOpen && (
            <FloatingPanel anchorRef={containerRef} className="rounded-xl border border-line bg-white shadow-pop dark:border-surface-border dark:bg-surface-raised">
              {/* Search input */}
              <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    placeholder="Type to search members..."
                    className="w-full h-9 pl-9 pr-8 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        handleSearchChange('');
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <FiX className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Options list */}
              <div className="min-h-0 max-h-60 flex-1 overflow-y-auto overscroll-contain">
                {isLoading ? (
                  <div className="flex items-center justify-center px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                    <FiLoader className="h-4 w-4 animate-spin mr-2" />
                    Searching...
                  </div>
                ) : filteredOptions.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-center">
                    {searchQuery ? 'No members found' : 'Type to search members'}
                  </div>
                ) : (
                  filteredOptions.map((option, index) => (
                    <button
                      key={option.value}
                      type="button"
                      data-index={index}
                      onClick={() => handleSelect(option.value)}
                      onMouseEnter={() => setFocusedIndex(index)}
                      className={cn(
                        'w-full px-3.5 py-2.5 text-left text-sm transition-colors duration-150',
                        'hover:bg-gray-50 dark:hover:bg-gray-800',
                        internalValue === option.value &&
                          'bg-mint font-bold text-primary-700 dark:bg-brand-lime/15 dark:text-brand-lime',
                        index === focusedIndex && 'bg-gray-50 dark:bg-gray-800'
                      )}
                    >
                      <div className="font-medium">{option.label}</div>
                      {option.sublabel && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{option.sublabel}</div>
                      )}
                    </button>
                  ))
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
);

SearchableSelect.displayName = 'SearchableSelect';

export default SearchableSelect;
