import { ReactNode } from 'react';
import Card from './Card';
import { cn } from '@/utils/cn';

export interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  /** Grid columns for the fields (responsive). Default 2. */
  columns?: 1 | 2 | 3;
  action?: ReactNode;
  className?: string;
}

/** Card with a bold title + muted description and a responsive field grid. */
export default function FormSection({ title, description, children, columns = 2, action, className }: FormSectionProps) {
  return (
    <Card padding="lg" className={className}>
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold text-[#18231E] dark:text-surface-text">{title}</h2>
          {description && <p className="mt-0.5 text-[12px] text-[#7B8983] dark:text-surface-muted">{description}</p>}
        </div>
        {action}
      </div>
      <div className={cn('grid grid-cols-1 gap-3.5', columns === 2 && 'md:grid-cols-2', columns === 3 && 'md:grid-cols-3')}>
        {children}
      </div>
    </Card>
  );
}

/** Read-only label/value rows for Review steps. Blank values show an em dash. */
export function ReviewList({ items }: { items: { label: string; value?: ReactNode }[] }) {
  return (
    <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
      {items.map((it) => (
        <div key={it.label} className="min-w-0">
          <dt className="text-[12px] font-semibold uppercase tracking-wide text-[#7B8983] dark:text-surface-muted">{it.label}</dt>
          <dd className="mt-0.5 break-words text-[13px] font-medium text-[#18231E] dark:text-surface-text">
            {it.value === undefined || it.value === null || it.value === '' ? <span className="text-[#98A59F]">-</span> : it.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
