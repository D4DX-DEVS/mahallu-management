import { ReactNode } from 'react';
import { cn } from '@/utils/cn';

export interface ActionBarProps {
  /**
   * Controls that describe the list rather than act on it — status tabs, a
   * result count. They sit at the start of the bar; the actions stay together
   * at the end.
   */
  leading?: ReactNode;
  /**
   * The bar's actions: ExpandableSearch, Filter, Refresh, Export and the
   * page's primary button, in that order. They share one cluster so the search
   * control always sits beside the button it belongs with.
   */
  children: ReactNode;
  className?: string;
}

/**
 * The one action bar for list pages.
 *
 * Search, filter, refresh, export and "+ New" used to be laid out per page,
 * most often as `justify-between` or a fixed-width wrapper around the search.
 * A collapsed search is a single 40px icon, so a wrapper sized for the
 * expanded field (w-56) or a spread-out row left that icon floating a few
 * hundred pixels away from the button it should sit next to.
 *
 * Here the actions are one right-aligned cluster. Nothing wraps: the field
 * gives up width (`min-w-0 flex-1` on a phone) while every other control keeps
 * its size, and labelled buttons collapse to their glyph below `sm`. Pass
 * `leading` and the bar stacks on a phone, with the leading controls above the
 * cluster, and sits on one line from `sm`.
 */
export default function ActionBar({ leading, children, className }: ActionBarProps) {
  const actions = <div className="flex min-w-0 items-center justify-end gap-2 sm:flex-1">{children}</div>;

  if (!leading) {
    return <div className={cn('mb-3 flex min-w-0 items-center justify-end gap-2', className)}>{children}</div>;
  }

  return (
    <div className={cn('mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3', className)}>
      <div className="min-w-0 sm:flex-shrink-0">{leading}</div>
      {actions}
    </div>
  );
}
