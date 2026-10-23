import { ReactNode, RefObject, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';

/**
 * Dropdown / popover surface rendered in a portal with fixed positioning, so it is never clipped by the
 * overflow of a modal body or table card. Flips above the anchor when there is no room below, never
 * taller than the visible space, follows the anchor on scroll / resize.
 * Click-outside handlers must treat `[data-floating-panel]` as inside (see isInsideFloating).
 */
// eslint-disable-next-line react-refresh/only-export-components -- helper shared with other files; only affects dev hot-reload
export const isInsideFloating = (target: EventTarget | null) =>
  target instanceof Element && !!target.closest('[data-floating-panel]');

interface Props {
  anchorRef: RefObject<HTMLElement>;
  children: ReactNode;
  className?: string;
  /** Preferred max height in px (default 320). */
  maxHeight?: number;
  /** Match the anchor's width (default true). */
  matchWidth?: boolean;
}

export default function FloatingPanel({ anchorRef, children, className, maxHeight = 320, matchWidth = true }: Props) {
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; width: number; maxH: number } | null>(null);

  useLayoutEffect(() => {
    const place = () => {
      const a = anchorRef.current;
      if (!a) return;
      const r = a.getBoundingClientRect();
      const vv = window.visualViewport;
      const vh = vv ? vv.height : window.innerHeight;
      const vw = window.innerWidth;
      const gap = 4;
      const below = vh - r.bottom - gap - 8;
      const above = r.top - gap - 8;
      const openUp = below < Math.min(maxHeight, 200) && above > below;
      const width = Math.min(matchWidth ? r.width : Math.max(r.width, 224), vw - 16);
      const left = Math.min(Math.max(8, r.left), vw - width - 8);
      setPos(
        openUp
          ? { left, bottom: window.innerHeight - r.top + gap, width, maxH: Math.min(maxHeight, Math.max(120, above)) }
          : { left, top: r.bottom + gap, width, maxH: Math.min(maxHeight, Math.max(120, below)) }
      );
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.visualViewport?.removeEventListener('resize', place);
    };
  }, [anchorRef, maxHeight, matchWidth]);

  if (!pos) return null;
  return createPortal(
    <div
      data-floating-panel
      className={cn('fixed z-[70] flex flex-col overflow-hidden', className)}
      style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, maxHeight: pos.maxH }}
    >
      {children}
    </div>,
    document.body
  );
}
