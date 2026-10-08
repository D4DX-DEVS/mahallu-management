import { ComponentType, ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface DetailItem {
  label: string;
  value?: ReactNode;
  /** Spans the whole row — for an address or a free-text note. */
  wide?: boolean;
  /** Renders in the Malayalam face. */
  malayalam?: boolean;
}

export interface DetailSectionProps {
  title?: string;
  icon?: ComponentType<{ className?: string }>;
  items: DetailItem[];
  /** Right side of the section heading, e.g. a count or a link. */
  aside?: ReactNode;
  /** Shown when every item is empty. Omit to render nothing at all. */
  emptyText?: string;
  className?: string;
}

const isEmpty = (value: ReactNode) => value === undefined || value === null || value === '' || value === false;

/**
 * A dense block of record fields: label over value, flowing into as many
 * columns as the width allows. Empty fields are left out rather than printed
 * as blank rows, so a sparse record takes a line, not a screen.
 *
 * Stack several inside one `Card padding="none"` with `divide-y` to show a
 * whole record as one compact panel.
 */
export default function DetailSection({ title, icon: Icon, items, aside, emptyText, className }: DetailSectionProps) {
  const visible = items.filter((item) => !isEmpty(item.value));
  if (visible.length === 0 && !emptyText) return null;
  return (
    <section className={cn('px-4 py-3.5 sm:px-5', className)}>
      {title && (
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {Icon && <Icon className="h-4 w-4 text-primary" aria-hidden="true" />}
            {title}
          </h2>
          {aside}
        </div>
      )}
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visible.map((item) => (
            <div key={item.label} className={cn('min-w-0', item.wide && 'col-span-full sm:col-span-2')}>
              <dt className="truncate text-xs text-muted-foreground">{item.label}</dt>
              <dd
                className={cn(
                  'mt-0.5 text-sm font-medium text-foreground',
                  item.wide ? 'break-words' : 'truncate',
                  item.malayalam && 'font-malayalam'
                )}
                title={typeof item.value === 'string' ? item.value : undefined}
              >
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
