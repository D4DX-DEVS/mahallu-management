import { useState } from 'react';
import QuickAddModal from '@/components/ui/QuickAddModal';
import Input from '@/components/ui/Input';
import { tenantService } from '@/services/tenantService';
import { errorMessage } from '@/utils/errors';

interface Props {
  open: boolean;
  onClose: () => void;
  settingKey: 'areaOptions' | 'educationOptions';
  label: string;
  placeholder?: string;
  tenantId: string;
  onCreated: (value: string) => void;
}

export default function QuickAddTenantSetting({
  open,
  onClose,
  settingKey,
  label,
  placeholder,
  tenantId,
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
      const tenant = await tenantService.getById(tenantId);
      const currentList: string[] = tenant.settings?.[settingKey] || [];
      if (currentList.includes(trimmed)) {
        setError(`"${trimmed}" already exists`);
        return;
      }
      const updatedSettings = {
        ...(tenant.settings || {}),
        [settingKey]: [...currentList, trimmed],
      };
      await tenantService.update(tenantId, { settings: updatedSettings });
      onCreated(trimmed);
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
