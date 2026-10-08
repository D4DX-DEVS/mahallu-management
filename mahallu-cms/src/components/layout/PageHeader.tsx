import { ComponentType, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { resolveNavIcon } from '@/constants/navIcons';
import { cn } from '@/utils/cn';

export interface Crumb {
  label: string;
  path?: string;
}

export interface PageHeaderProps {
  /** The page's single h1. Every page has exactly one. */
  title: string;
  /** Small context line for pages that belong to a larger workspace section. */
  eyebrow?: string;
  description?: string;
  /**
   * @deprecated Breadcrumbs are no longer rendered anywhere in the product.
   * The prop is still accepted so the 125 pages that pass a trail keep
   * compiling; the value is ignored. Remove the prop when a page is next
   * touched for another reason.
   */
  breadcrumbs?: Crumb[];
  /**
   * Overrides the icon resolved from the route. Pass `null` to render the
   * title with no icon — for a page that is not a module, such as an error
   * screen or a wizard step.
   */
  icon?: ComponentType<{ className?: string }> | null;
  /** Primary and secondary actions for this page, right-aligned. */
  actions?: ReactNode;
  className?: string;
}

/**
 * The one page header. Before this, title size, description size and vertical
 * rhythm were re-decided on all 245 pages — one list rendered its title at
 * 18px while the next form used 24px.
 *
 * The title carries the same icon the sidebar shows for the route, resolved
 * from `menuItems` rather than repeated here, so a page and its menu entry
 * always read as the same destination. Detail and form routes inherit their
 * module's icon.
 *
 * The title sits at 18px beside a 48px outlined icon disc, with the description
 * under it and a hairline closing the header off from the page body.
 *
 * There is no breadcrumb. The trail it printed — "Dashboard › Families" above
 * an <h1> reading "Families" — restated the page title under a link to a
 * destination the sidebar already shows, on a product whose navigation is
 * never more than two levels deep.
 */
export default function PageHeader({ title, eyebrow, description, icon, actions, className }: PageHeaderProps) {
  const { pathname } = useLocation();
  const Icon = icon === undefined ? resolveNavIcon(pathname) : icon;

  return (
    <div className={cn('mb-6 border-b border-border pb-5', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="flex min-w-0 items-center gap-3.5">
          {Icon && (
            <span
              aria-hidden="true"
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground/80 shadow-sm"
            >
              <Icon className="h-[22px] w-[22px]" />
            </span>
          )}
          <div className="min-w-0">
            {/* No `truncate`: a page title that does not fit wraps. */}
            {eyebrow && <p className="mb-0.5 text-xs font-medium uppercase tracking-wider text-primary">{eyebrow}</p>}
            <h1 className="text-lg font-semibold leading-tight tracking-tight text-foreground">{title}</h1>
            {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {/* Pass actions as `Button`s with `icon` + `collapseLabel` so they
            collapse to their glyphs on a phone instead of folding. */}
        {actions && (
          <div className="flex min-w-0 flex-shrink-0 flex-wrap items-center justify-start gap-2 sm:justify-end">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
}
