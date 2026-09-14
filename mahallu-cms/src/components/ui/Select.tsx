import {
  SelectHTMLAttributes,
  forwardRef,
  useState,
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
} from 'react';
import { createPortal } from 'react-dom';
import { FiChevronDown, FiSearch, FiX, FiPlus, FiCheck } from 'react-icons/fi';
import { cn } from '@/utils/cn';
import Field, { useFieldIds } from './Field';
import { controlClasses } from './Input';
export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label?: string;
  error?: string;
  helperText?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onAddNew?: () => void;
  addNewLabel?: string;
}
const nativeSelectValueSetter = Object.getOwnPropertyDescriptor(
  window.HTMLSelectElement.prototype,
  'value'
)?.set;
function setNativeSelectValue(node: HTMLSelectElement, value: string) {
  nativeSelectValueSetter?.call(node, value);
} /** * Listbox with an optional search filter, backed by a hidden native select so * react-hook-form registration keeps working unchanged. * * The menu is portalled to document.body with fixed positioning: an absolutely * positioned menu is clipped by the overflow-x-auto wrapper that every data * table puts around it. */
const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      options = [],
      value,
      onChange,
      disabled,
      onAddNew,
      addNewLabel = 'Add new',
      id,
      required,
      placeholder,
      ...props
    },
    ref
  ) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const [internalValue, setInternalValue] = useState(value ?? '');
    const [menuRect, setMenuRect] = useState<{
      top: number;
      left: number;
      width: number;
      maxHeight: number;
    } | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const selectRef = useRef<HTMLSelectElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const ids = useFieldIds({ id, error, helperText, required });
    const listboxId = ids.id + '-listbox';
    useEffect(() => {
      if (value !== undefined) setInternalValue(value);
    }, [value]);
    const needsSearch = options.length > 10;
    const showSearch = needsSearch && isOpen;
    const filteredOptions = showSearch
      ? options.filter((option) => option.label.toLowerCase().includes(searchQuery.toLowerCase()))
      : options;
    const selectedOption = options.find((opt) => opt.value === internalValue);
    const displayValue = selectedOption?.label ?? '';
    const commitValue = useCallback(
      (optionValue: string) => {
        setInternalValue(optionValue);
        const node = selectRef.current;
        if (node) setNativeSelectValue(node, optionValue);
        if (onChange) {
          const target =
            node ??
            ({ name: props.name, value: optionValue, type: 'select-one' } as unknown as HTMLSelectElement);
          onChange({
            target,
            currentTarget: target,
            type: 'change',
          } as unknown as React.ChangeEvent<HTMLSelectElement>);
        }
        setIsOpen(false);
        setSearchQuery('');
        setFocusedIndex(-1);
        triggerRef.current?.focus();
      },
      [onChange, props.name]
    );
    /*
     * Keep the portalled menu pinned to the trigger while the page scrolls.
     *
     * Always opens below the trigger. When the trigger sits near the bottom of
     * the viewport, the menu's height is capped to the remaining space so it
     * scrolls internally instead of running off-screen. */
    const positionMenu = useCallback(() => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const MAX_MENU_HEIGHT = 320; // max-h-80
      const GAP = 4;
      const VIEWPORT_MARGIN = 8;
      const spaceBelow = window.innerHeight - rect.bottom - GAP - VIEWPORT_MARGIN;
      const maxHeight = Math.min(MAX_MENU_HEIGHT, Math.max(spaceBelow, 100));
      setMenuRect({ top: rect.bottom + GAP, left: rect.left, width: rect.width, maxHeight });
    }, []);
    useLayoutEffect(() => {
      if (!isOpen) return;
      positionMenu();
      window.addEventListener('scroll', positionMenu, true);
      window.addEventListener('resize', positionMenu);
      return () => {
        window.removeEventListener('scroll', positionMenu, true);
        window.removeEventListener('resize', positionMenu);
      };
    }, [isOpen, positionMenu]);
    useEffect(() => {
      if (!isOpen) return;
      const handlePointerDown = (event: MouseEvent) => {
        const target = event.target as Node;
        if (wrapperRef.current?.contains(target) || menuRef.current?.contains(target)) return;
        setIsOpen(false);
        setSearchQuery('');
        setFocusedIndex(-1);
      };
      document.addEventListener('mousedown', handlePointerDown);
      if (showSearch) window.requestAnimationFrame(() => searchInputRef.current?.focus());
      return () => document.removeEventListener('mousedown', handlePointerDown);
    }, [isOpen, showSearch]);
    /*
     * Scoped to the component. A window-level listener swallowed arrow keys
     * typed into other fields while a select happened to be open. */
    const onKeyDown = (event: React.KeyboardEvent) => {
      if (disabled) return;
      if (!isOpen) {
        if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setIsOpen(true);
          setFocusedIndex(0);
        }
        return;
      }
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          setIsOpen(false);
          setSearchQuery('');
          setFocusedIndex(-1);
          triggerRef.current?.focus();
          break;
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Home':
          event.preventDefault();
          setFocusedIndex(0);
          break;
        case 'End':
          event.preventDefault();
          setFocusedIndex(filteredOptions.length - 1);
          break;
        case 'Enter':
          event.preventDefault();
          if (focusedIndex >= 0 && filteredOptions[focusedIndex]) {
            commitValue(filteredOptions[focusedIndex].value);
          }
          break;
        case 'Tab':
          setIsOpen(false);
          break;
        default:
          break;
      }
    };
    const activeOptionId =
      focusedIndex >= 0 && filteredOptions[focusedIndex] ? listboxId + '-opt-' + focusedIndex : undefined;
    const menu = isOpen && menuRect && (
      <div
        ref={menuRef}
        style={{
          position: 'fixed',
          top: menuRect.top,
          left: menuRect.left,
          width: menuRect.width,
          maxHeight: menuRect.maxHeight,
        }}
        className="z-[100] overflow-hidden rounded-md border border-border bg-popover text-popover-foreground shadow-md"
        onKeyDown={onKeyDown}
      >
        {showSearch && (
          <div className="border-b border-border p-2">
            <div className="relative">
              <FiSearch
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setFocusedIndex(0);
                }}
                placeholder="Search options"
                aria-label="Search options"
                className="h-8 w-full rounded-md border border-input bg-background pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    searchInputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <FiX className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
        <div
          role="listbox"
          id={listboxId}
          aria-label={label ?? 'Options'}
          className="max-h-60 overflow-y-auto p-1"
        >
          {filteredOptions.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              No options match your search
            </p>
          ) : (
            filteredOptions.map((option, index) => {
              const isSelected = option.value === internalValue;
              return (
                <div
                  key={option.value || 'blank-' + index}
                  id={listboxId + '-opt-' + index}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setFocusedIndex(index)}
                  onClick={() => commitValue(option.value)}
                  className={cn(
                    'flex cursor-pointer items-center justify-between gap-2 rounded-sm px-3 py-2 text-sm',
                    index === focusedIndex ? 'bg-accent text-accent-foreground' : 'text-foreground'
                  )}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && (
                    <FiCheck className="h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                  )}
                </div>
              );
            })
          )}
        </div>
        {onAddNew && (
          <div className="border-t border-border p-1">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onAddNew();
              }}
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-sm font-medium text-primary hover:bg-accent"
            >
              <FiPlus className="h-4 w-4" aria-hidden="true" /> {addNewLabel}
            </button>
          </div>
        )}
      </div>
    );
    return (
      <Field ids={ids} label={label} error={error} helperText={helperText} required={required}>
        <div className="relative" ref={wrapperRef}>
          {/* Hidden native select keeps react-hook-form registration intact. */}
          <select
            ref={(node) => {
              if (typeof ref === 'function') ref(node);
              else if (ref) ref.current = node;
              selectRef.current = node;
            }}
            value={internalValue}
            onChange={(e) => {
              setInternalValue(e.target.value);
              onChange?.(e);
            }}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            disabled={disabled}
            {...props}
          >
            {options.map((option, i) => (
              <option key={option.value || 'blank-' + i} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button
            ref={triggerRef}
            type="button"
            role="combobox"
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            aria-controls={isOpen ? listboxId : undefined}
            aria-activedescendant={activeOptionId}
            onClick={() => !disabled && setIsOpen((open) => !open)}
            onKeyDown={onKeyDown}
            disabled={disabled}
            className={cn(controlClasses, 'items-center justify-between text-left', className)}
            {...ids.controlProps}
          >
            <span className={cn('truncate', !displayValue && 'text-muted-foreground')}>
              {displayValue || placeholder || 'Select an option'}
            </span>
            <FiChevronDown
              className={cn(
                'ml-2 h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform',
                isOpen && 'rotate-180'
              )}
              aria-hidden="true"
            />
          </button>
        </div>
        {menu && createPortal(menu, document.body)}
      </Field>
    );
  }
);
Select.displayName = 'Select';

export default Select;
