import { InputHTMLAttributes, forwardRef } from 'react';
import { FiSearch, FiX } from 'react-icons/fi';
import { cn } from '@/utils/cn';

export interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onClear?: () => void;
}

const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, onClear, ...props }, ref) => {
    return (
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <FiSearch className="h-3.5 w-3.5 text-[#7B8983]" />
        </div>
        <input
          type="search"
          ref={ref}
          className={cn(
            'block h-[34px] max-sm:h-11 w-full rounded-[10px] border border-line bg-[#F4F7F5] pl-9 pr-9 text-xs text-[#18231E] placeholder:text-[#7B8983]',
            'transition-[border-color,box-shadow] focus:border-primary-600 focus:bg-white focus:outline-none focus:shadow-focus',
            'dark:border-surface-border dark:bg-surface-raised dark:text-surface-text dark:placeholder:text-surface-muted dark:focus:border-brand-lime dark:focus:bg-surface-raised',
            '[&::-webkit-search-cancel-button]:hidden',
            className
          )}
          {...props}
        />
        {props.value && onClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear search"
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-[#98A59F] hover:text-[#3A4741] dark:hover:text-surface-text"
          >
            <FiX className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }
);

SearchInput.displayName = 'SearchInput';

export default SearchInput;
