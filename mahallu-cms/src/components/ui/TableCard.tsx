import { forwardRef } from 'react';
import Card, { CardProps } from './Card';

export type TableCardProps = Omit<CardProps, 'frame'> & {
  /** Removes the redundant page-level outline while preserving table borders. */
  borderless?: boolean;
};

/**
 * The layout surface a list page uses for its toolbar, table and pagination.
 *
 * The default keeps the framed surface used by detail panels. List pages pass
 * `borderless` so the table owns the visible frame and the toolbar sits above
 * it without a second outline.
 *
 * Anything that is genuinely one card — a stat, a detail panel, a form
 * section — stays `Card`, which keeps its border at every width.
 */
const TableCard = forwardRef<HTMLDivElement, TableCardProps>(({ borderless = false, ...props }, ref) => (
  <Card ref={ref} frame={borderless ? 'none' : 'md-up'} {...props} />
));
TableCard.displayName = 'TableCard';

export default TableCard;
