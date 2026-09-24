import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { ROUTES } from '@/constants/routes';
import { masterAccountService } from '@/services/masterAccountService';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const walletSchema = z.object({
  name: z.string().max(200, 'Please keep the name to 200 characters or less.').min(1, 'Name is required'),
  type: z.enum(['main', 'reserve', 'charity'], { required_error: 'Type is required' }),
  balance: z.number().min(0, 'Balance must be 0 or greater').default(0),
});

type WalletFormData = z.infer<typeof walletSchema>;

export default function CreateWallet() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<WalletFormData>({
    resolver: zodResolver(walletSchema),
    defaultValues: {
      balance: 0,
      type: 'main',
    },
  });

  const onSubmit = async (data: WalletFormData) => {
    try {
      setError(null);
      await masterAccountService.createWallet({
        name: data.name,
        type: data.type,
        balance: data.balance || 0,
      });
      navigate(ROUTES.MASTER_ACCOUNTS.WALLETS);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'create wallet. please try again' }));
      console.error('Error creating wallet:', err);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        description="Add a new master wallet"
        title="Create"
        breadcrumbs={[{ label: 'Wallets', path: ROUTES.MASTER_ACCOUNTS.WALLETS }]}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input
                label="Wallet Name"
                {...register('name')}
                error={errors.name?.message}
                placeholder="e.g., Main Wallet, Reserve Fund"
              />
            </div>

            <Select
              label="Type"
              {...register('type')}
              error={errors.type?.message}
              options={[
                { value: 'main', label: 'Main' },
                { value: 'reserve', label: 'Reserve' },
                { value: 'charity', label: 'Charity' },
              ]}
            />

            <Input
              label="Initial Balance"
              type="number"
              step="0.01"
              {...register('balance', { valueAsNumber: true })}
              error={errors.balance?.message}
              placeholder="0.00"
            />
          </div>

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.MASTER_ACCOUNTS.WALLETS)}>
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <FiSave className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Creating...' : 'Create Wallet'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
