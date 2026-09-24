import { ReactNode, useId, useState } from 'react';
import { FiChevronDown } from 'react-icons/fi';
import { cn } from '@/utils/cn';

export interface FormSectionProps {
  title: string;
  description?: string;
  /** Collapsed sections start closed, so a long form opens at its required part. */
  defaultOpen?: boolean;
  /** Non-collapsible: always open, no toggle. Use for the required section. */
  alwaysOpen?: boolean;
  /** Shown beside the title, e.g. "Optional" or a completed count. */
  hint?: string;
  children: ReactNode;
  className?: string;
}

/**
 * A titled, optionally collapsible block of fields.
 *
 * The member form put ~30 fields on one screen with two headings and no way to
 * defer any of them. Grouping the optional two thirds behind collapsed sections
 * puts the required fields in the first screenful without changing what the
 * form submits.
 */
export default function FormSection({
  title,
  description,
  defaultOpen = true,
  alwaysOpen = false,
  hint,
  children,
  className,
}: FormSectionProps) {
  const [open, setOpen] = useState(alwaysOpen || defaultOpen);
  const panelId = useId();

  const header = (
    <div className="min-w-0 text-left">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {hint && <span className="text-label text-muted-foreground">{hint}</span>}
      </div>
      {description && <p className="mt-0.5 text-label text-muted-foreground">{description}</p>}
    </div>
  );

  return (
    <section className={cn('border-b border-border py-4 first:pt-0 last:border-b-0 last:pb-0', className)}>
      {alwaysOpen ? (
        <div className="mb-3">{header}</div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={panelId}
          className={cn(
            'flex w-full items-center justify-between gap-3 rounded-md text-left',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            open && 'mb-3'
          )}
        >
          {header}
          <FiChevronDown
            className={cn(
              'h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform',
              open && 'rotate-180'
            )}
            aria-hidden="true"
          />
        </button>
      )}
      <div id={panelId} hidden={!open}>
        {children}
      </div>
    </section>
  );
}
