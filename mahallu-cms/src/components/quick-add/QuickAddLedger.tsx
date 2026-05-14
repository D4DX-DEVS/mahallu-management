import { useState } from 'react';
import QuickAddModal from '@/components/ui/QuickAddModal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { masterAccountService, Ledger } from '@/services/masterAccountService';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (ledger: { id: string; label: string; type: string }) => void;
}

const typeOptions = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
];

export default function QuickAddLedger({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState('income');
  const [errors, setErrors] = useState<{ name?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErrors({ name: 'Ledger name is required' });
      return;
    }
    try {
      setIsLoading(true);
      setErrors({});
      const created: Ledger = await masterAccountService.createLedger({ name: trimmed, type });
      onCreated({ id: created.id, label: `${created.name} (${created.type})`, type: created.type || type });
      setName('');
      setType('income');
      onClose();
    } catch (err: any) {
      setErrors({ general: err.response?.data?.message || 'Failed to create ledger. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setType('income');
    setErrors({});
    onClose();
  };

  return (
    <QuickAddModal
      open={open}
      onClose={handleClose}
      title="Add New Ledger"
      onConfirm={handleConfirm}
      isLoading={isLoading}
      confirmLabel="Create Ledger"
    >
      <div className="space-y-4">
        {errors.general && (
          <p className="text-sm text-red-600 dark:text-red-400">{errors.general}</p>
        )}
        <Input
          label="Ledger Name"
          value={name}
          onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
          placeholder="Enter ledger name"
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
