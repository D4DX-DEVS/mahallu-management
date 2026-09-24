import { useState } from 'react';
import QuickAddModal from '@/components/ui/QuickAddModal';
import Input from '@/components/ui/Input';
import { categoryService } from '@/services/categoryService';
import { errorMessage } from '@/utils/errors';
interface Props {
  open: boolean;
  onClose: () => void;
  categoryKey: string;
  label: string;
  placeholder?: string;
  onCreated: (value: { value: string; label: string }) => void;
} /** Super-Admin-only "+ Add New" affordance for a Categories-backed dropdown. */
export default function QuickAddCategoryValue({
  open,
  onClose,
  categoryKey,
  label,
  placeholder,
  onCreated,
}: Props) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const handleConfirm = async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError(`${label} is required`);
      return;
    }
    try {
      setIsLoading(true);
      setError('');
      const created = await categoryService.createValueByKey(categoryKey, { code: trimmed, label: trimmed });
      onCreated({ value: created.code, label: created.label });
      setValue('');
      onClose();
    } catch (err: any) {
      setError(errorMessage(err, { action: 'add. please try again' }));
    } finally {
      setIsLoading(false);
    }
  };
  const handleClose = () => {
    setValue('');
    setError('');
    onClose();
  };
  return (
    <QuickAddModal
      open={open}
      onClose={handleClose}
      title={`Add ${label}`}
      onConfirm={handleConfirm}
      isLoading={isLoading}
      confirmLabel={`Add ${label}`}
    >
      <Input
        label={label}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setError('');
        }}
        onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
        placeholder={placeholder || `Enter ${label.toLowerCase()}`}
        error={error}
        autoFocus
      />
    </QuickAddModal>
  );
}
