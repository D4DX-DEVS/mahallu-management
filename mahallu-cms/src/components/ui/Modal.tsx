import { ReactNode, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
import { cn } from '@/utils/cn';
import { isTopOverlay, scrollFocusedIntoView, useKeyboardInset, useOverlay } from './modalLayer';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  /** Optional one-line description under the title */
  description?: string;
  children: ReactNode;
  /** `detail` = the 760px quick-view width used by DetailModal. */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'detail';
  footer?: ReactNode;
  /**
   * Replaces the default title bar with a custom header (DetailModal uses this).
   * Give the element that names the dialog an id and pass it as `labelledBy`.
   */
  header?: ReactNode;
  /** id of the element that labels the dialog (aria-labelledby). Defaults to the built-in title. */
  labelledBy?: string;
  /** Full-screen sheet below 640px (no margin, no radius). */
  mobileSheet?: boolean;
  /** Extra classes for the body (scroll area). */
  bodyClassName?: string;
  /** Extra classes for the dialog panel. */
  panelClassName?: string;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

/**
 * Pop-up shell. Contract (all dialogs in the app go through here):
 *  - rendered in a portal on <body> (never clipped / out-stacked by the page), z-60 above the sidebar;
 *  - the panel is never taller than the visible viewport (dvh + visual viewport when the keyboard is open);
 *  - header and footer are fixed, ONLY the body scrolls (overscroll contained, no scroll chaining to the page);
 *  - the page behind is locked (see modalLayer.ts), Escape / Tab act on the top-most dialog only;
 *  - safe-area insets are respected; focused fields scroll into view above the on-screen keyboard.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  footer,
  header,
  labelledBy,
  mobileSheet = false,
  bodyClassName,
  panelClassName,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { id, setEl } = useOverlay(isOpen);
  const kbStyle = useKeyboardInset(isOpen);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      // an open dropdown / menu consumes the first Escape
      if (e.key === 'Escape' && isTopOverlay(id) && !document.querySelector('[data-floating-panel]')) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, id]);

  // Focus trap: move focus into the dialog, keep Tab inside it, give focus back on close.
  useEffect(() => {
    if (!isOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    panel?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !panelRef.current || !isTopOverlay(id)) return;
      const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (n) => n.offsetParent !== null || n === document.activeElement
      );
      const active = document.activeElement as HTMLElement | null;
      // dropdown panels are portaled out of the dialog but belong to it
      if (active?.closest('[data-floating-panel]')) return;
      if (nodes.length === 0) {
        e.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && (active === first || active === panelRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (!panelRef.current.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (previous && document.contains(previous)) previous.focus({ preventScroll: true });
    };
  }, [isOpen, id]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    detail: 'max-w-[760px]',
  };

  return createPortal(
    <div
      ref={setEl}
      data-modal-overlay
      style={kbStyle}
      className={cn(
        'fixed inset-0 z-[60] !m-0 flex items-center justify-center overflow-hidden overscroll-none bg-[#0F1412]/55',
        mobileSheet ? 'p-0 sm:p-4' : 'p-3 sm:p-4'
      )}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={labelledBy || !title ? undefined : title}
        aria-labelledby={labelledBy ?? (title ? titleId : undefined)}
        className={cn(
          'flex min-h-0 w-full flex-col overflow-hidden border border-line bg-white shadow-pop outline-none focus-visible:!outline-none',
          'dark:border-surface-border dark:bg-surface-card',
          mobileSheet
            ? 'h-full max-h-full rounded-none pt-[env(safe-area-inset-top)] sm:h-auto sm:max-h-[min(90dvh,100%)] sm:rounded-modal sm:pt-0'
            : 'max-h-full rounded-modal sm:max-h-[min(90dvh,100%)]',
          sizeClasses[size],
          panelClassName
        )}
      >
        {header ??
          (title && (
            <div className="flex flex-shrink-0 items-start justify-between gap-3 border-b border-line-soft px-4 py-3.5 sm:px-5 sm:py-4 dark:border-surface-border">
              <div className="min-w-0">
                <h2 id={titleId} className="break-words text-base font-extrabold tracking-tight text-primary-700 dark:text-surface-text">{title}</h2>
                {description && <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">{description}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close dialog"
                className="-mr-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-[#7B8983] transition-colors hover:bg-[#F4F7F5] hover:text-[#18231E] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] sm:h-8 sm:w-8 dark:text-surface-muted dark:hover:bg-surface-hover dark:hover:text-surface-text"
              >
                <FiX className="h-4 w-4" />
              </button>
            </div>
          ))}

        <div
          data-modal-body
          onFocus={scrollFocusedIntoView}
          className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 text-[13px] [-webkit-overflow-scrolling:touch] sm:px-5', bodyClassName)}
        >
          {children}
        </div>

        {footer && (
          <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2.5 border-t border-line-soft bg-[#FAFCFB] px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:rounded-b-modal sm:px-5 sm:py-3.5 dark:border-surface-border dark:bg-surface-base/40">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
