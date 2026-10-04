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
 * The title uses the shared 16px page-heading step with a 44px icon tile beside it.
 * The page title and the application it belongs to now read as one line across
 * the top of the window rather than as two competing headings. The description
 * stays at the body-sm step so the pair keeps a visible hierarchy.
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
    <div className={cn('mb-6', className)}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span
              aria-hidden="true"
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm"
            >
              <Icon className="h-5 w-5" />
            </span>
          )}
          <div className="min-w-0">
            {/* No `truncate`: a page title that does not fit wraps. Cutting
                it off is how a phone ends up headed "Family Varisangya Tran…". */}
            {eyebrow && <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>}
            <h1 className="text-base font-semibold leading-tight tracking-tight text-foreground">
              {title}
            </h1>
            {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
          </div>
        </div>
        {/* One row, at every width. A header's actions are two or three
            controls; wrapping them turned a phone header into three lines of
            chrome. Pass them as `Button`s with `icon` + `collapseLabel` so
            they collapse to their glyphs instead of folding onto a new row. */}
        {actions && <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
