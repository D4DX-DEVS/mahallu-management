import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiSave, FiX } from 'react-icons/fi';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { masterAccountService, Ledger } from '@/services/masterAccountService';

const ledgerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  nameMl: z.string().optional(),
  type: z.enum(['income', 'expense'], { required_error: 'Type is required' }),
  description: z.string().optional(),
});

type LedgerFormData = z.infer<typeof ledgerSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (ledger: { id: string; label: string; type: string }) => void;
}

export default function QuickAddLedger({ open, onClose, onCreated }: Props) {
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LedgerFormData>({
    resolver: zodResolver(ledgerSchema),
    defaultValues: { type: 'income' },
  });

  const onSubmit = async (data: LedgerFormData) => {
    try {
      setError(null);
      const created: Ledger = await masterAccountService.createLedger({
        name: data.name,
        nameMl: data.nameMl,
        type: data.type,
        description: data.description,
      });
      onCreated({ id: created.id, label: `${created.name} (${created.type})`, type: created.type || data.type });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create ledger. Please try again.');
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Add New Ledger" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Input
              label="Ledger Name"
              {...register('name')}
              error={errors.name?.message}
              placeholder="e.g., Monthly Income, Operating Expenses"
              required
            />
          </div>
          <div className="md:col-span-2 hidden">
            <Input
              label="Ledger Name (Malayalam)"
              {...register('nameMl')}
              placeholder="ലെഡ്ജർ നാമം"
              className="font-malayalam"
            />
          </div>
          <Select
            label="Type"
            {...register('type')}
            error={errors.type?.message}
            options={[
              { value: 'income', label: 'Income' },
              { value: 'expense', label: 'Expense' },
            ]}
          />
          <div className="md:col-span-2">
            <Input
              label="Description"
              {...register('description')}
              placeholder="Optional description"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="outline" onClick={onClose}>
            <FiX className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            <FiSave className="h-4 w-4 mr-2" />
            Create Ledger
          </Button>
        </div>
      </form>
    </Modal>
  );
}
