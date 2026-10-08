import { useEffect, useId, useRef, useState } from 'react';
import { FiSearch, FiX } from 'react-icons/fi';
import { cn } from '@/utils/cn';

export interface ExpandableSearchProps {
  value: string;
  onChange: (value: string) => void;
  /**
   * What is being searched, e.g. "families". Writes the placeholder, the
   * visually hidden label and the collapsed button's accessible name, so a
   * screen reader hears "Search families" rather than 44 identical "Search"
   * buttons.
   */
  entity?: string;
  /** Overrides the placeholder derived from `entity`. */
  placeholder?: string;
  /**
   * Width of the expanded field. The compact state is one control wide on a
   * phone; desktop lists keep the field visible and let it fill the free
   * width of the toolbar.
   */
  expandedClassName?: string;
  className?: string;
  id?: string;
  autoFocusOnExpand?: boolean;
  /** Keep the full field visible at sm+ while retaining the compact mobile trigger. */
  desktopAlwaysVisible?: boolean;
}

/**
 * The list-level search control.
 *
 * It stays as a full search field on desktop, matching the list pattern used
 * by the Teams reference, and collapses to a single icon button on phones.
 *
 * The collapsed state is a real <button>, in the tab order, with an accessible
 * name: an earlier version collapsed to a decorative icon with tabIndex={-1},
 * which put the primary discovery control on 44 screens out of keyboard reach.
 *
 * A non-empty query holds the field open. A search that is applied but hidden
 * behind an icon reads as "the list is broken", so collapsing always clears.
 */
export default function ExpandableSearch({
  value,
  onChange,
  entity,
  placeholder,
  expandedClassName = 'w-full min-w-0 flex-1 sm:w-72 sm:flex-none',
  className,
  id,
  autoFocusOnExpand = true,
  desktopAlwaysVisible = true,
}: ExpandableSearchProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const label = entity ? `Search ${entity}` : 'Search';

  const [isExpanded, setIsExpanded] = useState(() => Boolean(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  /* Focus follows the control the user just opened, but not on first paint —
   * a page restoring a query from the URL would otherwise steal focus from
   * the document on load. */
  const shouldFocus = useRef(false);

  useEffect(() => {
    if (isExpanded && shouldFocus.current && autoFocusOnExpand) {
      inputRef.current?.focus();
      shouldFocus.current = false;
    }
  }, [isExpanded, autoFocusOnExpand]);

  // An external reset — "Clear filters" on the empty state — closes the field.
  useEffect(() => {
    if (!value) return;
    setIsExpanded(true);
  }, [value]);

  /* "/" jumps to the list search from anywhere on the page, unless the user
   * is already typing in a field. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]')) return;
      event.preventDefault();
      if (inputRef.current && inputRef.current.offsetParent !== null) {
        inputRef.current.focus();
      } else {
        shouldFocus.current = true;
        setIsExpanded(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const collapse = (returnFocus: boolean) => {
    onChange('');
    setIsExpanded(false);
    if (returnFocus) {
      // Focus the control that remains visible at this breakpoint, or focus
      // falls back to <body> and the tab order restarts.
      window.requestAnimationFrame(() => {
        const desktop = desktopAlwaysVisible && window.matchMedia('(min-width: 640px)').matches;
        (desktop ? inputRef.current : buttonRef.current)?.focus();
      });
    }
  };

  return (
    <div
      className={cn(
        'relative flex items-center transition-[width] duration-200 ease-out motion-reduce:transition-none',
        /* From `sm` the field takes all the free width in its row, so the
         * toolbar reads as one full line rather than a short field floating
         * beside the buttons. */
        desktopAlwaysVisible
          ? 'w-10 flex-none sm:w-auto sm:min-w-[12rem] sm:flex-1'
          : isExpanded
            ? expandedClassName
            : 'w-10 flex-none',
        className
      )}
    >
      {isExpanded || desktopAlwaysVisible ? (
        <>
          <label htmlFor={inputId} className="sr-only">
            {label}
          </label>
          <FiSearch
            className={cn(
              'pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground',
              desktopAlwaysVisible && !isExpanded && 'hidden sm:block'
            )}
            aria-hidden="true"
          />
          <input
            ref={inputRef}
            id={inputId}
            type="search"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                collapse(true);
              }
            }}
            onBlur={() => {
              // Leaving an empty field puts the toolbar back the way it was.
              // A field holding a query stays open so the filter stays visible.
              if (!value) setIsExpanded(false);
            }}
            placeholder={placeholder ?? label}
            className={cn(
              'peer h-10 w-full rounded-lg border border-border bg-card pl-9 pr-10 text-sm text-foreground shadow-sm transition-colors',
              'placeholder:text-muted-foreground hover:border-input/60 focus-visible:border-primary/60 focus-visible:outline-none',
              'focus-visible:ring-4 focus-visible:ring-primary/10',
              // type="search" grows its own native clear icon in Chromium/WebKit once the
              // field has a value, sitting right on top of the custom FiX button below —
              // two X's while typing. Only the native one needs hiding.
              '[&::-webkit-search-cancel-button]:appearance-none [&::-ms-clear]:hidden',
              desktopAlwaysVisible && !isExpanded && 'hidden sm:block'
            )}
          />
          {!value && (
            <kbd
              aria-hidden="true"
              className="pointer-events-none absolute right-2.5 top-1/2 hidden h-5 min-w-5 -translate-y-1/2 items-center justify-center rounded border border-border bg-subtle px-1 font-sans text-[11px] font-medium text-muted-foreground peer-focus:opacity-0 sm:inline-flex"
            >
              /
            </kbd>
          )}
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()} // Beat the input's blur.
            onClick={() => collapse(true)}
            aria-label={value ? 'Clear search' : 'Close search'}
            className={cn(
              'absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              desktopAlwaysVisible && !isExpanded && 'hidden',
              // On desktop the empty field has nothing to clear; the "/" hint sits there instead.
              !value && 'sm:hidden'
            )}
          >
            <FiX className="h-4 w-4" aria-hidden="true" />
          </button>
        </>
      ) : null}
      {!isExpanded && (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => {
            shouldFocus.current = true;
            setIsExpanded(true);
          }}
          aria-label={label}
          aria-expanded={false}
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-subtle hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            desktopAlwaysVisible && 'sm:hidden'
          )}
        >
          <FiSearch className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
