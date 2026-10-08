import { ReactNode, useCallback, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { RiCloseLine } from 'react-icons/ri';
import { cn } from '@/utils/cn';
import { getModalPortalTarget } from '@/utils/modalPortal';
import Button from './Button';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  /** Optional supporting line under the title. Announced with the dialog. */
  description?: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: ReactNode;
  overlay?: boolean;
  /** Render the close control even when the caller supplies no visible title. */
  showCloseButton?: boolean;
  /** When true, clicking the backdrop does not close — use for dirty forms. */
  disableBackdropClose?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* The first thing a user fills in, when the dialog has fields. */
const FIRST_FIELD =
  'input:not([disabled]):not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([tabindex="-1"]), textarea:not([disabled]), [role="combobox"]:not([disabled])';

/*
 * Nested modals must not fight over body scroll: the lock is reference counted,
 * so an inner modal closing cannot restore page scroll while an outer one is
 * still open.
 */
let scrollLocks = 0;

function lockScroll() {
  if (scrollLocks === 0) document.body.style.overflow = 'hidden';
  scrollLocks += 1;
}

function releaseScroll() {
  scrollLocks = Math.max(0, scrollLocks - 1);
  if (scrollLocks === 0) document.body.style.overflow = '';
}

export default function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  footer,
  overlay = true,
  showCloseButton = false,
  disableBackdropClose = false,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  /*
   * onClose is almost always a fresh inline arrow function from the caller, so
   * it gets a new identity on every parent render — including every keystroke
   * in a controlled input inside the modal. Reading it through a ref (rather
   * than depending on it) keeps handleKeyDown's identity, and therefore the
   * effect below, stable across those re-renders. Previously the effect's dep
   * array included handleKeyDown, so it tore down and reran on every
   * keystroke, which called restoreFocusRef.current?.focus() and yanked focus
   * off the field the user was typing into.
   */
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (event.key !== 'Tab' || !panelRef.current) return;

    /* Focus trap: Tab cycles inside the dialog instead of escaping behind it. */
    const nodes = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (node) => node.offsetParent !== null
    );
    if (nodes.length === 0) {
      event.preventDefault();
      panelRef.current.focus();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    lockScroll();
    document.addEventListener('keydown', handleKeyDown, true);

    /* Move focus into the dialog so the keyboard lands where the eye does. */
    const frame = window.requestAnimationFrame(() => {
      const body = panelRef.current?.querySelector<HTMLElement>('.modal-body');
      const field = Array.from(body?.querySelectorAll<HTMLElement>(FIRST_FIELD) ?? []).find(
        (node) => node.offsetParent !== null
      );
      const target = field ?? panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panelRef.current ?? null;
      target?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKeyDown, true);
      releaseScroll();
      restoreFocusRef.current?.focus?.();
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
  };

  const { node: portalTarget, scoped } = getModalPortalTarget();

  return createPortal(
    <div
      className={cn(
        scoped ? 'absolute inset-0' : 'fixed inset-0',
        'z-50 flex items-end justify-center p-2 animate-fade-in sm:items-center sm:p-4',
        overlay && 'bg-foreground/30'
      )}
      onMouseDown={(event) => {
        if (disableBackdropClose) return;
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        aria-label={title ? undefined : 'Dialog'}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92vh] max-h-[92dvh] w-full flex-col overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-md',
          sizeClasses[size]
        )}
      >
        {/* Untitled dialogs (create/edit forms bring their own header) get a
            floating close control instead of an empty header bar. */}
        {!title && showCloseButton && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close dialog"
            className="absolute right-3 top-3 z-10 sm:right-4 sm:top-4"
          >
            <RiCloseLine className="h-[18px] w-[18px]" />
          </Button>
        )}
        {title && (
          <div className="flex items-start justify-between gap-3 border-b border-border p-4 sm:p-5">
            <div className="min-w-0">
              {title && (
                <h2 id={titleId} className="break-words text-lg font-semibold text-foreground">
                  {title}
                </h2>
              )}
              {description && title && (
                <p id={descId} className="mt-1 text-sm text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              aria-label="Close dialog"
              className="flex-shrink-0"
            >
              <RiCloseLine className="h-[18px] w-[18px]" />
            </Button>
          </div>
        )}

        <div className="modal-body min-w-0 flex-1 overflow-y-auto p-5 sm:p-6">{children}</div>

        {footer && (
          <div className="flex flex-col-reverse items-stretch gap-2 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:p-5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    portalTarget
  );
}
