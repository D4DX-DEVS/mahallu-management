import { ReactNode } from 'react';
import Modal from './Modal';
import Button from './Button';

interface QuickAddModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  onConfirm: () => void;
  isLoading?: boolean;
  confirmLabel?: string;
  children: ReactNode;
}

export default function QuickAddModal({
  open,
  onClose,
  title,
  onConfirm,
  isLoading = false,
  confirmLabel = 'Add',
  children,
}: QuickAddModalProps) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="button" onClick={onConfirm} isLoading={isLoading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Modal>
  );
}
