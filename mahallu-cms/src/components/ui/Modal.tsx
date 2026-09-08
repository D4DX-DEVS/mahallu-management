import { ReactNode, useCallback, useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { FiX } from 'react-icons/fi';
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
  /** When true, clicking the backdrop does not close — use for dirty forms. */
  disableBackdropClose?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  disableBackdropClose = false,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const descId = useId();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
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
    },
    [onClose]
  );

  useEffect(() => {
    if (!isOpen) return;

    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    lockScroll();
    document.addEventListener('keydown', handleKeyDown, true);

    /* Move focus into the dialog so the keyboard lands where the eye does. */
    const frame = window.requestAnimationFrame(() => {
      const target = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE) ?? panelRef.current ?? null;
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
        'z-50 flex items-end justify-center p-2 sm:items-center sm:p-4',
        overlay && 'bg-foreground/25'
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
          'flex max-h-[90vh] max-h-[90dvh] w-full flex-col rounded-lg border border-border bg-card text-card-foreground shadow-md',
          sizeClasses[size]
        )}
      >
        {title && (
          <div className="flex items-start justify-between gap-3 border-b border-border p-4 sm:p-6">
            <div className="min-w-0">
              <h2 id={titleId} className="break-words text-lg font-semibold text-foreground">
                {title}
              </h2>
              {description && (
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
              <FiX className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</div>

        {footer && (
          <div className="flex flex-col-reverse items-stretch gap-2 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:p-6">
            {footer}
          </div>
        )}
      </div>
    </div>,
    portalTarget
  );
}
