import { useState } from 'react';
import QuickAddModal from '@/components/ui/QuickAddModal';
import Input from '@/components/ui/Input';
import { committeeService } from '@/services/committeeService';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (committee: { id: string; label: string }) => void;
}

export default function QuickAddCommittee({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Committee name is required');
      return;
    }
    try {
      setIsLoading(true);
      setError('');
      const created = await committeeService.create({ name: trimmed });
      onCreated({ id: created.id, label: created.name });
      setName('');
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create committee. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setError('');
    onClose();
  };

  return (
    <QuickAddModal
      open={open}
      onClose={handleClose}
      title="Add New Committee"
      onConfirm={handleConfirm}
      isLoading={isLoading}
      confirmLabel="Create Committee"
    >
      <Input
        label="Committee Name"
        value={name}
        onChange={(e) => { setName(e.target.value); setError(''); }}
        onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
        placeholder="Enter committee name"
        error={error}
        required
        autoFocus
      />
    </QuickAddModal>
  );
}
