import { forwardRef } from 'react';
import Card, { CardProps } from './Card';
import { TableSlotProvider } from './tableSlot';

export type TableCardProps = Omit<CardProps, 'frame'>;

/**
 * The layout surface a list page uses for its toolbar, table and pagination.
 *
 * From `md` up it is a framed card (border, card ground, padding) so the list
 * reads as one clear section against the page. Below `md` the table becomes a
 * list of bordered cards, so the surface drops its own frame there (see Card's
 * `md-up` frame).
 *
 * It also hosts the slot that lets the table's sort control sit in the
 * toolbar row (see tableSlot).
 */
const TableCard = forwardRef<HTMLDivElement, TableCardProps>(({ children, ...props }, ref) => (
  <Card ref={ref} frame="md-up" {...props}>
    <TableSlotProvider>{children}</TableSlotProvider>
  </Card>
));
TableCard.displayName = 'TableCard';

export default TableCard;
