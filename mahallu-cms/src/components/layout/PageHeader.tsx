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
 * One title size at every width: 24px, the scale's own "page title" step —
 * a full step above a card or section heading (18px), so the one <h1> on the
 * page outranks everything under it instead of matching the sidebar's own
 * 18px product name. The description under it stays 13px at every width so
 * the pair keeps a visible step.
 *
 * There is no breadcrumb. The trail it printed — "Dashboard › Families" above
 * an <h1> reading "Families" — restated the page title under a link to a
 * destination the sidebar already shows, on a product whose navigation is
 * never more than two levels deep.
 */
export default function PageHeader({ title, description, icon, actions, className }: PageHeaderProps) {
  const { pathname } = useLocation();
  const Icon = icon === undefined ? resolveNavIcon(pathname) : icon;

  return (
    <div className={cn('mb-4 sm:mb-5', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span
              aria-hidden="true"
              className="hidden h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex"
            >
              <Icon className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            <h1 className="text-xl font-semibold leading-tight tracking-tight text-foreground sm:text-2xl">
              {title}
            </h1>
            {description && <p className="mt-1 text-sm text-muted-foreground sm:text-label">{description}</p>}
          </div>
        </div>
        {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
      </div>
    </div>
  );
}
