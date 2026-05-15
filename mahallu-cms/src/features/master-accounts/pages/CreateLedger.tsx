import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { ROUTES } from '@/constants/routes';
import { masterAccountService } from '@/services/masterAccountService';

const ledgerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  nameMl: z.string().optional(),
  type: z.enum(['income', 'expense'], { required_error: 'Type is required' }),
  description: z.string().optional(),
});

type LedgerFormData = z.infer<typeof ledgerSchema>;

export default function CreateLedger() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LedgerFormData>({
    resolver: zodResolver(ledgerSchema),
    defaultValues: {
      type: 'income',
    },
  });

  const onSubmit = async (data: LedgerFormData) => {
    try {
      setError(null);
      await masterAccountService.createLedger({
        name: data.name,
        nameMl: data.nameMl,
        type: data.type,
        description: data.description,
      });
      navigate(ROUTES.MASTER_ACCOUNTS.LEDGERS);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create ledger. Please try again.');
      console.error('Error creating ledger:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Create Ledger</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Add a new income or expense ledger</p>
        </div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Ledgers', path: ROUTES.MASTER_ACCOUNTS.LEDGERS },
            { label: 'Create' },
          ]}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input label="Ledger Name" {...register('name')} error={errors.name?.message} placeholder="e.g., Monthly Income, Operating Expenses" />
            </div>
            <div className="md:col-span-2 hidden">
              <Input label="Ledger Name (Malayalam)" {...register('nameMl')} placeholder="ലെഡ്ജർ നാമം" className="font-malayalam" />
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
              <Input label="Description" {...register('description')} error={errors.description?.message} placeholder="Optional description" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.MASTER_ACCOUNTS.LEDGERS)}>
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <FiSave className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Creating...' : 'Create Ledger'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}

