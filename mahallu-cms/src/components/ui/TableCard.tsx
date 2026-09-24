import { forwardRef } from 'react';
import Card, { CardProps } from './Card';

export type TableCardProps = Omit<CardProps, 'frame'>;

/**
 * The surface a list page puts around its toolbar, table and pagination.
 *
 * It is a `Card` from `md` up and nothing at all below it. On a phone the
 * `Table` inside renders one bordered card per record, so a bordered, padded
 * surface around them drew a box around boxes: a second border tracing the
 * viewport edge, 24px of its padding taken out of a 320px screen, and every
 * record card inset inside a frame it did not need. The record card is the
 * only frame a phone shows.
 *
 * Anything that is genuinely one card — a stat, a detail panel, a form
 * section — stays `Card`, which keeps its border at every width.
 */
const TableCard = forwardRef<HTMLDivElement, TableCardProps>((props, ref) => (
  <Card ref={ref} frame="md-up" {...props} />
));
TableCard.displayName = 'TableCard';

export default TableCard;
