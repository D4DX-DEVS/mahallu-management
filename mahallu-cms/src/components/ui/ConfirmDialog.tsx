import Modal from './Modal';
import Button from './Button';
export interface ConfirmDialogProps {
  isOpen: boolean;
  /*
   * Name the action and its object: "Delete this family?" — not "Are you sure?". */
  title?: string; /** What is about to happen, in the user's terms. */
  message: string;
  /*
   * Knock-on effects, e.g. "12 members will be left without a family." */
  consequence?: string;
  /*
   * Name the action: "Delete family" — not "Confirm". */
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
} /*
 * The one confirmation dialog for destructive or irreversible actions. */
export default function ConfirmDialog({
  isOpen,
  title = 'Confirm this action?',
  message,
  consequence,
  confirmLabel,
  cancelLabel = 'Cancel',
  isLoading = false,
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const resolvedConfirm = confirmLabel ?? (variant === 'danger' ? 'Delete' : 'Continue');
  return (
    <Modal
      isOpen={isOpen}
      title={title}
      onClose={isLoading ? () => {} : onCancel}
      size="sm"
      disableBackdropClose={isLoading}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            /*
             * isLoading disables the button, so the request cannot be
             * double-submitted. Callers used to swap the label text instead and
             * leave the button live for the whole round trip. */
            isLoading={isLoading}
            loadingText={variant === 'danger' ? 'Deleting' : 'Working'}
          >
            {resolvedConfirm}
          </Button>
        </>
      }
    >
      <p className="text-sm text-foreground">{message}</p>
      {consequence && <p className="mt-2 text-sm text-warning">{consequence}</p>}
    </Modal>
  );
}
