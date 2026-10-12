import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { ROUTES } from '@/constants/routes';
import { masterAccountService } from '@/services/masterAccountService';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

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
      toast.error(getFriendlyError(err, "Couldn't create ledger. Check the details and try again."));
      console.error('Error creating ledger:', err);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Create Ledger" description="Add a new income or expense ledger" />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}

          <Card padding="lg">
          <h3 className="text-sm font-bold text-primary-700 dark:text-surface-text">Ledger details</h3>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Name and type of the ledger</p>

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
          </Card>

          <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none rounded-b-card border-t border-line bg-white/90 px-4 py-3 backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.MASTER_ACCOUNTS.LEDGERS)}>
              <FiX className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <FiSave className="h-3.5 w-3.5" />
              {isSubmitting ? 'Creating...' : 'Create Ledger'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

