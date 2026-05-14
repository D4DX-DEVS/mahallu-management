import { useState } from 'react';
import QuickAddModal from '@/components/ui/QuickAddModal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { instituteService } from '@/services/instituteService';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (institute: { id: string; label: string }) => void;
}

const typeOptions = [
  { value: 'institute', label: 'Institute' },
  { value: 'madrasa', label: 'Madrasa' },
  { value: 'orphanage', label: 'Orphanage' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'other', label: 'Other' },
];

export default function QuickAddInstitute({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState('institute');
  const [errors, setErrors] = useState<{ name?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErrors({ name: 'Institute name is required' });
      return;
    }
    try {
      setIsLoading(true);
      setErrors({});
      const created = await instituteService.create({ name: trimmed, type });
      onCreated({ id: created.id, label: created.name });
      setName('');
      setType('institute');
      onClose();
    } catch (err: any) {
      setErrors({ general: err.response?.data?.message || 'Failed to create institute. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setType('institute');
    setErrors({});
    onClose();
  };

  return (
    <QuickAddModal
      open={open}
      onClose={handleClose}
      title="Add New Institute"
      onConfirm={handleConfirm}
      isLoading={isLoading}
      confirmLabel="Create Institute"
    >
      <div className="space-y-4">
        {errors.general && (
          <p className="text-sm text-red-600 dark:text-red-400">{errors.general}</p>
        )}
        <Input
          label="Institute Name"
          value={name}
          onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
          placeholder="Enter institute name"
          error={errors.name}
          required
          autoFocus
        />
        <Select
          label="Type"
          value={type}
          options={typeOptions}
          onChange={(e) => setType(e.target.value)}
        />
      </div>
    </QuickAddModal>
  );
}
