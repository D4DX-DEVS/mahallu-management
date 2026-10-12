import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { ROUTES } from '@/constants/routes';
import { masterAccountService } from '@/services/masterAccountService';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const walletSchema = z.object({
  name: z.string().min(1, 'Name is required'),
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
      toast.error(getFriendlyError(err, "Couldn't create wallet. Check the details and try again."));
      console.error('Error creating wallet:', err);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Create Wallet" description="Add a new master wallet" />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}

          <Card padding="lg">
          <h3 className="text-sm font-bold text-primary-700 dark:text-surface-text">Wallet details</h3>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Name and balance of the wallet</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input label="Wallet Name" {...register('name')} error={errors.name?.message} placeholder="e.g., Main Wallet, Reserve Fund" />
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
          </Card>

          <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none rounded-b-card border-t border-line bg-white/90 px-4 py-3 backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.MASTER_ACCOUNTS.WALLETS)}>
              <FiX className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <FiSave className="h-3.5 w-3.5" />
              {isSubmitting ? 'Creating...' : 'Create Wallet'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

