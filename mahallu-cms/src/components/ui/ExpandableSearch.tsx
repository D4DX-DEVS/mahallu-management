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
   * Width of the expanded field. The collapsed state is always one control
   * wide. The default takes the row it is in on a phone and settles at 18rem
   * from `sm`; `min-w-0` is what stops a flex row from being pushed past the
   * viewport when the field opens beside a Filter and a Refresh button.
   */
  expandedClassName?: string;
  className?: string;
  id?: string;
  autoFocusOnExpand?: boolean;
}

/**
 * The list-level search control.
 *
 * It rests as a single icon button and opens into a field, which keeps the
 * toolbar of a dense list page from being half search box — the control is
 * used on a minority of visits but was taking a third of the row on every one.
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

  const collapse = (returnFocus: boolean) => {
    onChange('');
    setIsExpanded(false);
    if (returnFocus) {
      // The button replaces the input in the same spot; focus has to be moved
      // deliberately or it falls back to <body> and the tab order restarts.
      window.requestAnimationFrame(() => buttonRef.current?.focus());
    }
  };

  return (
    <div
      className={cn(
        'relative flex items-center transition-[width] duration-200 ease-out motion-reduce:transition-none',
        isExpanded ? expandedClassName : 'w-10 flex-none',
        className
      )}
    >
      {isExpanded ? (
        <>
          <label htmlFor={inputId} className="sr-only">
            {label}
          </label>
          <FiSearch
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
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
              'h-10 w-full rounded-md border border-input bg-background pl-9 pr-9 text-sm text-foreground',
              'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2',
              'focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
            )}
          />
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()} // Beat the input's blur.
            onClick={() => collapse(true)}
            aria-label={value ? 'Clear search' : 'Close search'}
            className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FiX className="h-4 w-4" aria-hidden="true" />
          </button>
        </>
      ) : (
        <button
          ref={buttonRef}
          type="button"
          onClick={() => {
            shouldFocus.current = true;
            setIsExpanded(true);
          }}
          aria-label={label}
          aria-expanded={false}
          className="flex h-10 w-10 items-center justify-center rounded-md border border-input bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <FiSearch className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
