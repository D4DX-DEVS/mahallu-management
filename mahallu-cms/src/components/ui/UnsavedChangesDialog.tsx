import ConfirmDialog from './ConfirmDialog';
import type { UnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';

/** Renders the "Leave without saving?" prompt for a form using useUnsavedChangesGuard. */
export default function UnsavedChangesDialog({ guard }: { guard: UnsavedChangesGuard }) {
  return (
    <ConfirmDialog
      isOpen={guard.isBlocked}
      title="Unsaved changes"
      message="You have unsaved changes. Leave without saving?"
      confirmLabel="Discard"
      cancelLabel="Stay"
      variant="danger"
      onConfirm={guard.discard}
      onCancel={guard.stay}
    />
  );
}
