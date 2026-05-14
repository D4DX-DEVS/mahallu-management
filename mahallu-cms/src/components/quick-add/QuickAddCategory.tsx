import { useState } from 'react';
import QuickAddModal from '@/components/ui/QuickAddModal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { masterAccountService, Category } from '@/services/masterAccountService';

interface Props {
  open: boolean;
  onClose: () => void;
  defaultType?: 'income' | 'expense';
  onCreated: (category: { id: string; label: string; type: string }) => void;
}

const typeOptions = [
  { value: 'income', label: 'Income' },
  { value: 'expense', label: 'Expense' },
];

export default function QuickAddCategory({ open, onClose, defaultType = 'income', onCreated }: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState(defaultType);
  const [errors, setErrors] = useState<{ name?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setErrors({ name: 'Category name is required' });
      return;
    }
    try {
      setIsLoading(true);
      setErrors({});
      const created: Category = await masterAccountService.createCategory({ name: trimmed, type });
      onCreated({ id: created.id, label: created.name, type: created.type || type });
      setName('');
      setType(defaultType);
      onClose();
    } catch (err: any) {
      setErrors({ general: err.response?.data?.message || 'Failed to create category. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setType(defaultType);
    setErrors({});
    onClose();
  };

  return (
    <QuickAddModal
      open={open}
      onClose={handleClose}
      title="Add New Category"
      onConfirm={handleConfirm}
      isLoading={isLoading}
      confirmLabel="Create Category"
    >
      <div className="space-y-4">
        {errors.general && (
          <p className="text-sm text-red-600 dark:text-red-400">{errors.general}</p>
        )}
        <Input
          label="Category Name"
          value={name}
          onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
          placeholder="Enter category name"
          error={errors.name}
          required
          autoFocus
        />
        <Select
          label="Type"
          value={type}
          options={typeOptions}
          onChange={(e) => setType(e.target.value as 'income' | 'expense')}
        />
      </div>
    </QuickAddModal>
  );
}
