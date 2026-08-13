import Modal from './Modal';
import Button from './Button';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title?: string;
  /** What is about to happen, in the user's terms. */
  message: string;
  /** Optional extra line for knock-on effects, e.g. "Linked distributions will keep their records." */
  consequence?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  variant?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

/** Styled replacement for window.confirm() on destructive or irreversible actions. */
export default function ConfirmDialog({
  isOpen,
  title = 'Are you sure?',
  message,
  consequence,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isLoading = false,
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} title={title} onClose={onCancel} size="sm">
      <p className="text-gray-700 dark:text-gray-200">{message}</p>
      {consequence && (
        <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{consequence}</p>
      )}
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="outline" onClick={onCancel} disabled={isLoading}>
          {cancelLabel}
        </Button>
        <Button variant={variant === 'danger' ? 'danger' : 'primary'} onClick={onConfirm} disabled={isLoading}>
          {isLoading ? 'Working...' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
