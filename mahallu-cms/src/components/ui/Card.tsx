import { HTMLAttributes, forwardRef } from 'react';
import { cn } from '@/utils/cn';
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  /*
   *
   * Only for cards that actually navigate somewhere. A card that lifts on
   * hover and does nothing is a broken promise — pass `onClick` too. */
  hoverEffect?: boolean;
}
const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, padding = 'md', hoverEffect = false, children, onClick, ...props }, ref) => {
    /* 24px of padding on each side of a 320px phone leaves 240px for the card's
     * own content, before the page's own gutters. Every step drops to 12px
     * below `sm` and keeps its desktop generosity above it. */
    const paddingClasses = { none: '', sm: 'p-2 sm:p-3', md: 'p-3 sm:p-4', lg: 'p-3 sm:p-6' };
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
          'rounded-lg border border-border bg-card text-card-foreground shadow-none sm:shadow-sm',
          interactive && 'cursor-pointer transition-colors hover:bg-accent/40',
          hoverEffect && interactive && 'transition-shadow hover:shadow-md',
          paddingClasses[padding],
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
