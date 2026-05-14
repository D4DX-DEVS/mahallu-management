import { useState } from 'react';
import QuickAddModal from '@/components/ui/QuickAddModal';
import Input from '@/components/ui/Input';
import { tenantService } from '@/services/tenantService';

interface Props {
  open: boolean;
  onClose: () => void;
  tenantId: string;
  onCreated: (grade: { name: string; amount: number }) => void;
}

export default function QuickAddVarisangyaGrade({ open, onClose, tenantId, onCreated }: Props) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [errors, setErrors] = useState<{ name?: string; amount?: string; general?: string }>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    const trimmedName = name.trim();
    const parsedAmount = parseFloat(amount);
    const newErrors: typeof errors = {};

    if (!trimmedName) newErrors.name = 'Grade name is required';
    if (!amount || isNaN(parsedAmount) || parsedAmount < 0) newErrors.amount = 'Valid amount is required';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    try {
      setIsLoading(true);
      setErrors({});
      const tenant = await tenantService.getById(tenantId);
      const currentGrades: { name: string; amount: number }[] = tenant.settings?.varisangyaGrades || [];
      if (currentGrades.some((g) => g.name === trimmedName)) {
        setErrors({ name: `Grade "${trimmedName}" already exists` });
        return;
      }
      const updatedSettings = {
        ...(tenant.settings || {}),
        varisangyaGrades: [...currentGrades, { name: trimmedName, amount: parsedAmount }],
      };
      await tenantService.update(tenantId, { settings: updatedSettings });
      onCreated({ name: trimmedName, amount: parsedAmount });
      setName('');
      setAmount('');
      onClose();
    } catch (err: any) {
      setErrors({ general: err.response?.data?.message || 'Failed to add grade. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setAmount('');
    setErrors({});
    onClose();
  };

  return (
    <QuickAddModal
      open={open}
      onClose={handleClose}
      title="Add Varisangya Grade"
      onConfirm={handleConfirm}
      isLoading={isLoading}
      confirmLabel="Add Grade"
    >
      <div className="space-y-4">
        {errors.general && (
          <p className="text-sm text-red-600 dark:text-red-400">{errors.general}</p>
        )}
        <Input
          label="Grade Name"
          value={name}
          onChange={(e) => { setName(e.target.value); setErrors((p) => ({ ...p, name: undefined })); }}
          placeholder="e.g. Gold, Silver, Bronze"
          error={errors.name}
          autoFocus
        />
        <Input
          label="Amount (₹)"
          type="number"
          min={0}
          value={amount}
          onChange={(e) => { setAmount(e.target.value); setErrors((p) => ({ ...p, amount: undefined })); }}
          placeholder="0"
          error={errors.amount}
        />
      </div>
    </QuickAddModal>
  );
}
