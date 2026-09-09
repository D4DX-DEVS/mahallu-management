/* The one row-action button.
 *
 * 36px on a phone, 32px in a table row: a real touch target where fingers are
 * and a compact one where a mouse is, so three actions add ~100px to a column
 * rather than pushing the table into a horizontal scroll.
 *
 * Danger and warning stay neutral until pointed at. A column of red trash
 * icons reads as an alarm on every row of an otherwise ordinary list; the
 * colour belongs on the action being taken, not on the list at rest.
 *
 * `ActionsMenu` renders these from an `items` array. Import `rowActionClass`
 * directly for the handful of tables that build their action cell by hand — a
 * react-router `Link`, a control with its own spinner. Sharing the class is
 * what keeps every row action in the product one size and one colour; a page
 * writing its own `p-1.5 text-red-600` is how they drifted apart before.
 */
import { cn } from '@/utils/cn';

export type RowActionVariant = 'default' | 'danger' | 'warning';

export const ROW_ACTION_BASE =
  'inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground ' +
  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-8 md:w-8 ' +
  '[&>svg]:h-4 [&>svg]:w-4';

export const ROW_ACTION_VARIANT: Record<RowActionVariant, string> = {
  default: 'hover:bg-accent hover:text-accent-foreground focus-visible:text-accent-foreground',
  danger: 'hover:bg-destructive/10 hover:text-destructive focus-visible:text-destructive',
  warning: 'hover:bg-warning/10 hover:text-warning focus-visible:text-warning',
};

export function rowActionClass(variant: RowActionVariant = 'default', className?: string) {
  return cn(ROW_ACTION_BASE, ROW_ACTION_VARIANT[variant], className);
}
