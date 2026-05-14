import { useState } from 'react';
import QuickAddModal from '@/components/ui/QuickAddModal';
import Input from '@/components/ui/Input';
import { familyService } from '@/services/familyService';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (family: { id: string; label: string }) => void;
}

export default function QuickAddFamily({ open, onClose, onCreated }: Props) {
  const [houseName, setHouseName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    const trimmed = houseName.trim();
    if (!trimmed) {
      setError('House name is required');
      return;
    }
    try {
      setIsLoading(true);
      setError('');
      const created = await familyService.create({ houseName: trimmed });
      onCreated({ id: created.id, label: created.houseName });
      setHouseName('');
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create family. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setHouseName('');
    setError('');
    onClose();
  };

  return (
    <QuickAddModal
      open={open}
      onClose={handleClose}
      title="Add New Family"
      onConfirm={handleConfirm}
      isLoading={isLoading}
      confirmLabel="Create Family"
    >
      <Input
        label="House Name"
        value={houseName}
        onChange={(e) => { setHouseName(e.target.value); setError(''); }}
        onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
        placeholder="Enter house name"
        error={error}
        required
        autoFocus
      />
    </QuickAddModal>
  );
}
