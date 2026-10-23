import { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';
import { useModalPage } from '@/hooks/useModalContext';

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  /** Right-aligned actions (secondary then primary Button) */
  actions?: ReactNode;
  /** Optional element above the title (e.g. a back link) */
  eyebrow?: ReactNode;
  /** Optional leading element before the title, e.g. <Avatar size={56} /> on detail pages */
  leading?: ReactNode;
  className?: string;
}

/**
 * Standard page heading: 22px extrabold green title, muted description, actions on the right.
 * The breadcrumb lives in the global Header, so pages no longer render their own.
 */
export default function PageHeader({ title, description, actions, eyebrow, leading, className }: PageHeaderProps) {
  const modal = useModalPage();
  if (modal.isInModal) {
    // Inside a route modal the heading becomes the compact modal header (no eyebrow/breadcrumb).
    if (!modal.headerEl) return null;
    return createPortal(
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className={cn('min-w-0', leading && 'flex items-center gap-3')}>
          {leading && <div className="shrink-0">{leading}</div>}
          <div className="min-w-0">
            <h2 id={modal.titleId} className="break-words text-base font-extrabold tracking-tight text-primary-700 dark:text-surface-text">
              {title}
            </h2>
            {description && <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>,
      modal.headerEl
    );
  }
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between', className)}>
      <div className={cn('min-w-0', leading && 'flex items-center gap-3.5')}>
        {leading && <div className="shrink-0">{leading}</div>}
        <div className="min-w-0">
          {eyebrow && <div className="mb-1 text-xs text-[#7B8983] dark:text-surface-muted">{eyebrow}</div>}
          <h1 className="break-words text-xl font-extrabold sm:text-[22px] leading-tight tracking-[-0.02em] text-primary-700 dark:text-surface-text">
            {title}
          </h1>
          {description && <p className="mt-0.5 break-words text-[12.5px] text-[#7B8983] dark:text-surface-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex min-w-0 flex-wrap items-center gap-2 max-sm:[&>*]:min-w-0">{actions}</div>}
    </div>
  );
}
