import { ReactNode } from 'react';
import { FiX } from 'react-icons/fi';
import { cn } from '@/utils/cn';

export interface FilterPanelProps {
  /** Renders the dismiss control. Omit for a panel that cannot be closed. */
  onClose?: () => void;
  /** Accessible name for the dismiss control. */
  closeLabel?: string;
  children: ReactNode;
  className?: string;
}

/**
 * The filter row a list page opens above its table.
 *
 * Fourteen pages carried the same forty-character class string inline, each
 * with its own copy of the close button. They are one component now.
 *
 * The frame follows the same rule as `TableCard`: a bordered, padded panel
 * from `md`, and nothing below it, where the page has no surface of its own
 * and the filters read as fields on the page — the layout the reference
 * screenshot shows. The dismiss control sits in reserved space rather than on
 * top of the first field; at phone widths the old absolutely positioned button
 * landed over it, because the panel dropped its padding but the button kept
 * its 16px inset.
 */
export default function FilterPanel({ onClose, closeLabel = 'Close filters', children, className }: FilterPanelProps) {
  return (
    <div className={cn('relative mb-4 md:rounded-lg md:border md:border-border md:bg-card md:p-4', className)}>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label={closeLabel}
          className="absolute right-0 top-0 rounded-sm p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:right-3 md:top-3"
        >
          <FiX className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      <div className={cn('flex flex-wrap items-center gap-4', onClose && 'pr-8 md:pr-6')}>{children}</div>
    </div>
  );
}
