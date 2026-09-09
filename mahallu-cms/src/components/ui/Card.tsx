import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /*
   *
   * Only for cards that actually navigate somewhere. A card that lifts on
   * hover and does nothing is a broken promise — pass `onClick` too. */
  hoverEffect?: boolean;
  /**
   * When the frame is drawn.
   *
   * `always` is the card in a list of cards — the reference layout, one
   * bordered record per row at every width.
   *
   * `md-up` is the surface a list *page* puts around its toolbar, table and
   * pagination. Below `md` the table inside it stops being a table and becomes
   * a list of bordered cards, so the surface would be a second box drawn around
   * boxes: a border hugging the viewport, its padding stealing 24px of a 320px
   * screen, and every card inset inside it. Below `md` it is therefore a plain
   * container — no border, no ground, no padding, no shadow — and the cards are
   * the only frame on screen. From `md` up, where the table is a real table, it
   * is an ordinary Card again. Use `TableCard`, which sets this.
   */
  frame?: 'always' | 'md-up';
}

/* Four steps, 8 / 12 / 16 / 20 at desktop, each one step tighter on a phone.
 * `lg` used to be 24px; a panel drawn at 24px on every side spent 48px of a
 * 1280px column on nothing, and stacked three deep down a detail page that is
 * a screenful of air before the first field. 20px still reads as the roomiest
 * surface in the product without being the largest thing on the page.
 *
 * Padding is dropped below `md` on a `md-up` card for the same reason its
 * border is: the cards inside it carry their own. */
const PADDING = {
  always: { none: '', sm: 'p-2 sm:p-3', md: 'p-3 sm:p-4', lg: 'p-4 sm:p-5' },
  'md-up': { none: '', sm: 'md:p-3', md: 'md:p-4', lg: 'md:p-5' },
} as const;

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    { className, padding = 'md', hoverEffect = false, frame = 'always', children, onClick, ...props },
    ref
  ) => {
    /* 24px of padding on each side of a 320px phone leaves 240px for the card's
     * own content, before the page's own gutters. Every step drops to 12px
     * below `sm` and keeps its desktop generosity above it. */
    const interactive = Boolean(onClick);
    return (
      <div
        ref={ref}
        onClick={onClick}
        className={cn(
          /* One frame at every width.
           *
           * The border used to be dropped below `sm`, on the reasoning that a
           * full-width card has nothing beside it to separate from. In a list
           * of them that reads as no card at all: the records run together
           * against the page and a phone list of cards looks unlike the same
           * list rendered by Table, which does draw a border. Same frame as
           * Table's phone cards — `rounded-lg border border-border bg-card` —
           * so a list looks the same whichever component built it. The shadow
           * still waits for `sm`, where a card sits beside something. */
          frame === 'always'
            ? 'rounded-lg border border-border bg-card text-card-foreground shadow-none sm:shadow-sm'
            : 'text-card-foreground md:rounded-lg md:border md:border-border md:bg-card md:shadow-sm',
          interactive && 'cursor-pointer transition-colors hover:bg-accent/40',
          hoverEffect && interactive && 'transition-shadow hover:shadow-md',
          PADDING[frame][padding],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

export default Card;
