import { ReactNode, RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/utils/cn';
import { useIsPhone } from '@/hooks/useMediaQuery';
import { useScrollLock } from '../modalLayer';

interface Props {
  open: boolean;
  anchorRef: RefObject<HTMLElement>;
  /** refocus = true when closed from the keyboard / by choosing (focus returns to the field). */
  onClose: (refocus: boolean) => void;
  children: ReactNode;
  /** Desktop width in px (the sheet is always full width on phones). */
  width?: number;
  label: string;
}

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex="0"]';

/**
 * Popover shell for the ZAAD date/time pickers: portal + fixed positioning with collision handling on
 * desktop (flips above, clamps into the viewport, never clipped by a modal body), bottom sheet with drag
 * handle below 640 px. Sits above route modals (z 60/70) and toasts (z 200). Escape closes only the popover.
 */
export default function PickerPopover({ open, anchorRef, onClose, children, width = 304, label }: Props) {
  const phone = useIsPhone();
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number; maxH: number } | null>(null);
  const [vv, setVv] = useState({ bottom: 0, h: typeof window === 'undefined' ? 800 : window.innerHeight });
  const [drag, setDrag] = useState(0);
  const dragStart = useRef<number | null>(null);
  useScrollLock(open && phone);

  const place = useCallback(() => {
    const a = anchorRef.current;
    const p = panelRef.current;
    if (!a || !p) return;
    const r = a.getBoundingClientRect();
    const v = window.visualViewport;
    const vh = v ? v.height : window.innerHeight;
    const vw = window.innerWidth;
    const gap = 6;
    const h = p.offsetHeight;
    const w = Math.min(width, vw - 16);
    const below = vh - r.bottom - gap - 8;
    const above = r.top - gap - 8;
    const flip = h > below && above > below;
    let top = flip ? r.top - gap - Math.min(h, above) : r.bottom + gap;
    top = Math.max(8, Math.min(top, vh - Math.min(h, vh - 16) - 8));
    const left = Math.min(Math.max(8, r.left), vw - w - 8);
    setPos({ left, top, maxH: vh - 16 });
  }, [anchorRef, width]);

  useLayoutEffect(() => {
    if (!open || phone) return;
    place();
    const ro = typeof ResizeObserver !== 'undefined' && panelRef.current ? new ResizeObserver(place) : null;
    if (ro && panelRef.current) ro.observe(panelRef.current);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    window.visualViewport?.addEventListener('resize', place);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      window.visualViewport?.removeEventListener('resize', place);
    };
  }, [open, phone, place]);

  // phones: follow the visual viewport (on-screen keyboard)
  useEffect(() => {
    if (!open || !phone) return;
    const v = window.visualViewport;
    const update = () => {
      const h = v ? v.height : window.innerHeight;
      const off = v ? v.offsetTop : 0;
      setVv({ bottom: Math.max(0, window.innerHeight - h - off), h });
    };
    update();
    v?.addEventListener('resize', update);
    v?.addEventListener('scroll', update);
    return () => {
      v?.removeEventListener('resize', update);
      v?.removeEventListener('scroll', update);
    };
  }, [open, phone]);

  useEffect(() => {
    if (!open) {
      setPos(null);
      setDrag(0);
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // close only the popover: the route modal underneath must not see this Escape
      e.stopPropagation();
      e.preventDefault();
      onClose(true);
    };
    const onDown = (e: Event) => {
      const t = e.target as Node | null;
      if (!t) return;
      if (panelRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose(false);
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const trap = (e: React.KeyboardEvent) => {
    if (e.key !== 'Tab' || !panelRef.current) return;
    const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((n) => n.tabIndex >= 0 && n.offsetParent !== null);
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const act = document.activeElement;
    if (e.shiftKey && act === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && act === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const surface =
    'border border-line bg-white text-[#18231E] shadow-pop dark:border-surface-border dark:bg-surface-card dark:text-surface-text';

  if (phone) {
    return createPortal(
      <div data-floating-panel className="fixed inset-0 z-[210]" style={{ bottom: vv.bottom }}>
        <div className="absolute inset-0 bg-[#0F1412]/55" onPointerDown={() => onClose(false)} />
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          onKeyDown={trap}
          style={{ maxHeight: Math.max(280, vv.h - 12), transform: drag ? `translateY(${drag}px)` : undefined, transition: dragStart.current === null ? 'transform .2s' : 'none' }}
          className={cn('absolute inset-x-0 bottom-0 flex flex-col overflow-hidden rounded-t-2xl border-b-0 outline-none', surface)}
        >
          <div
            className="flex h-6 flex-shrink-0 cursor-grab touch-none items-center justify-center"
            onPointerDown={(e) => {
              dragStart.current = e.clientY;
              e.currentTarget.setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              if (dragStart.current !== null) setDrag(Math.max(0, e.clientY - dragStart.current));
            }}
            onPointerUp={() => {
              const d = drag;
              dragStart.current = null;
              if (d > 90) onClose(true);
              else setDrag(0);
            }}
            onPointerCancel={() => {
              dragStart.current = null;
              setDrag(0);
            }}
            aria-hidden="true"
          >
            <span className="h-1 w-10 rounded-full bg-[#C9D6CF] dark:bg-surface-border-strong" />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-[max(12px,env(safe-area-inset-bottom))]">{children}</div>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      ref={panelRef}
      data-floating-panel
      role="dialog"
      aria-label={label}
      onKeyDown={trap}
      style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, width: Math.min(width, window.innerWidth - 16), maxHeight: pos?.maxH, opacity: pos ? 1 : 0, pointerEvents: pos ? undefined : 'none' }}
      className={cn('fixed z-[210] overflow-y-auto rounded-xl p-3 outline-none', surface)}
    >
      {children}
    </div>,
    document.body
  );
}
