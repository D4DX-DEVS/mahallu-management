import { ReactNode, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { hasInAppHistory, parentListPath } from '@/utils/formModalClose';
import ConfirmDialog from './ConfirmDialog';
import Modal from './Modal';

/* The footer buttons that leave the form without saving. */
const CANCEL_LABEL = /^(cancel|discard|close)$/i;

interface FormModalRouteProps {
  children: ReactNode;
}

/**
 * Gives every create/edit route the same modal treatment without coupling form
 * implementations to routing. Forms with five or fewer controls stay in one
 * column; larger forms get a two-column workspace on wider screens.
 *
 * Closing (Escape, the close button or the form's Cancel) asks first when the user has typed in
 * the form, and goes back to the parent list rather than blindly `navigate(-1)`
 * when the form was opened by a deep link or a refresh.
 */
export default function FormModalRoute({ children }: FormModalRouteProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const contentRef = useRef<HTMLDivElement>(null);
  const [layout, setLayout] = useState<'single' | 'double'>('single');
  const [dirty, setDirty] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  /* Escape reaches every open modal's key listener in the same event. A ref, not
   * state, so the form's own handler sees the confirm dialog as already open. */
  const confirmOpenRef = useRef(false);

  /* Measured on mount and again whenever fields are added. An edit form first
   * renders a loading skeleton with no controls, so a mount-only count locked it
   * to one column for good. Only ever widens: a conditional field appearing or
   * disappearing must not make the form jump between layouts mid-edit. */
  useLayoutEffect(() => {
    const node = contentRef.current;
    if (!node) return;
    const measure = () => {
      const controls = node.querySelectorAll(
        'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])'
      );
      if (controls.length > 5) {
        setLayout('double');
        observer.disconnect();
      }
    };
    const observer = new MutationObserver(measure);
    observer.observe(node, { childList: true, subtree: true });
    measure();
    return () => observer.disconnect();
  }, []);

  const closeNow = useCallback(() => {
    if (hasInAppHistory()) navigate(-1);
    else navigate(parentListPath(location.pathname), { replace: true });
  }, [navigate, location.pathname]);

  const requestClose = useCallback(() => {
    if (confirmOpenRef.current) return;
    if (dirty) {
      confirmOpenRef.current = true;
      setConfirmOpen(true);
      return;
    }
    closeNow();
  }, [dirty, closeNow]);

  const cancelDiscard = () => {
    setConfirmOpen(false);
    /* Released on the next tick so the Escape that cancelled the dialog cannot
     * also be read by this form's own listener as a fresh close request. */
    window.setTimeout(() => {
      confirmOpenRef.current = false;
    }, 0);
  };

  /* `input` and `change` bubble (React's onInput/onChange too, including out of
   * portalled pickers), so one listener on the wrapper sees every edit. */
  const markDirty = () => setDirty(true);

  /* A form's own Cancel button navigates away directly. Once the user has
   * typed something it goes through the same discard confirmation as Escape
   * and the close button, instead of losing the edits (or a native confirm). */
  const confirmCancel = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!dirty) return;
    const button = (event.target as HTMLElement).closest('button');
    if (!button || button.type === 'submit' || !CANCEL_LABEL.test(button.textContent?.trim() ?? '')) return;
    const row = button.closest('a')?.parentElement ?? button.parentElement;
    if (!row?.querySelector('button[type="submit"]')) return;
    event.preventDefault();
    event.stopPropagation();
    requestClose();
  };

  /* Ctrl/⌘ + Enter submits from any field. */
  const submitOnShortcut = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return;
    const form = contentRef.current?.querySelector('form');
    if (!form) return;
    event.preventDefault();
    form.requestSubmit();
  };

  return (
    <>
      <Modal isOpen onClose={requestClose} size="xl" showCloseButton disableBackdropClose>
        <div
          ref={contentRef}
          className={`form-modal-content form-modal-${layout}`}
          onInput={markDirty}
          onChange={markDirty}
          onKeyDown={submitOnShortcut}
          onClickCapture={confirmCancel}
        >
          {children}
        </div>
      </Modal>
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Discard your changes?"
        message="You have unsaved changes in this form. If you close it now they will be lost."
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onConfirm={() => {
          confirmOpenRef.current = false;
          setConfirmOpen(false);
          setDirty(false);
          closeNow();
        }}
        onCancel={cancelDiscard}
      />
    </>
  );
}
