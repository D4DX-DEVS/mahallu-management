import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

/**
 * Horizontal scroll container for hand-built tables. Contains the overflow inside the card and fades the
 * right (and left) edge while more content is scrolled out of view, so phone users see it can be swiped.
 */
export default function ScrollX({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setEdge((p) => (p.left === left && p.right === right ? p : { left, right }));
  }, []);

  useEffect(() => {
    update();
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => ro.disconnect();
  }, [update]);

  return (
    <div className="relative">
      <div ref={ref} onScroll={update} className={cn('overflow-x-auto overscroll-x-contain', className)} tabIndex={0}>
        {children}
      </div>
      {edge.left && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white to-transparent dark:from-surface-card" />
      )}
      {edge.right && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent dark:from-surface-card" />
      )}
    </div>
  );
}
