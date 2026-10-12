import { useState, useEffect } from 'react';
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
import QuickAddInstitute from '@/components/quick-add/QuickAddInstitute';
import { ROUTES } from '@/constants/routes';
import { masterAccountService } from '@/services/masterAccountService';
import { instituteService } from '@/services/instituteService';
import { Institute } from '@/types';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const instituteAccountSchema = z.object({
  instituteId: z.string().min(1, 'Institute is required'),
  accountName: z.string().min(1, 'Account Name is required'),
  accountNumber: z.string().optional(),
  bankName: z.string().optional(),
  ifscCode: z.string().optional(),
  balance: z.number().min(0, 'Balance must be 0 or greater').default(0),
  status: z.enum(['active', 'inactive']).optional(),
});

type InstituteAccountFormData = z.infer<typeof instituteAccountSchema>;

export default function CreateInstituteAccount() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loadingInstitutes, setLoadingInstitutes] = useState(false);
  const [addInstituteOpen, setAddInstituteOpen] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<InstituteAccountFormData>({
    resolver: zodResolver(instituteAccountSchema),
    defaultValues: {
      balance: 0,
      status: 'active',
    },
  });

  useEffect(() => {
    fetchInstitutes();
  }, []);

  const fetchInstitutes = async () => {
    try {
      setLoadingInstitutes(true);
      const result = await instituteService.getAll({ status: 'active' });
      setInstitutes(result.data || []);
    } catch (err) {
      console.error('Error fetching institutes:', err);
      setInstitutes([]);
    } finally {
      setLoadingInstitutes(false);
    }
  };

  const onSubmit = async (data: InstituteAccountFormData) => {
    try {
      setError(null);
      await masterAccountService.createInstituteAccount({
        instituteId: data.instituteId,
        accountName: data.accountName,
        accountNumber: data.accountNumber,
        bankName: data.bankName,
        ifscCode: data.ifscCode,
        balance: data.balance || 0,
        status: data.status || 'active',
      });
      navigate(ROUTES.MASTER_ACCOUNTS.INSTITUTE_ACCOUNTS);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create institute account. Check the details and try again."));
      console.error('Error creating institute account:', err);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="
          Create Institute Account
        " description="
          Add a new bank account for an institute
        " />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}

          <Card padding="lg">
          <h3 className="text-sm font-bold text-primary-700 dark:text-surface-text">Account details</h3>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Institute bank account information</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Select
                label="Institute"
                {...register('instituteId')}
                value={watch('instituteId') || ''}
                onAddNew={() => setAddInstituteOpen(true)}
                addNewLabel="Add Institute"
                error={errors.instituteId?.message}
                disabled={loadingInstitutes}
                options={[
                  { value: '', label: 'Select an institute' },
                  ...institutes.map((institute) => ({
                    value: institute.id,
                    label: `${institute.name} - ${institute.place}`,
                  })),
                ]}
              />
            </div>

            <div className="md:col-span-2">
              <Input
                label="Account Name"
                {...register('accountName')}
                error={errors.accountName?.message}
                placeholder="e.g., Main Account, Savings Account"
              />
            </div>

            <Input
              label="Account Number"
              {...register('accountNumber')}
              error={errors.accountNumber?.message}
              placeholder="Enter account number"
            />

            <Input
              label="Bank Name"
              {...register('bankName')}
              error={errors.bankName?.message}
              placeholder="Enter bank name"
            />

            <Input
              label="IFSC Code"
              {...register('ifscCode')}
              error={errors.ifscCode?.message}
              placeholder="Enter IFSC code"
            />

            <Input
              label="Initial Balance"
              type="number"
              step="0.01"
              {...register('balance', { valueAsNumber: true })}
              error={errors.balance?.message}
              placeholder="0.00"
            />

            <Select
              label="Status"
              {...register('status')}
              error={errors.status?.message}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
          </div>
          </Card>

          <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none rounded-b-card border-t border-line bg-white/90 px-4 py-3 backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(ROUTES.MASTER_ACCOUNTS.INSTITUTE_ACCOUNTS)}
            >
              <FiX className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <FiSave className="h-3.5 w-3.5" />
              {isSubmitting ? 'Creating...' : 'Create Account'}
            </Button>
          </div>
        </div>
      </form>

      <QuickAddInstitute
        open={addInstituteOpen}
        onClose={() => setAddInstituteOpen(false)}
        onCreated={(newInstitute) => {
          setInstitutes((prev) => [...prev, { id: newInstitute.id, name: newInstitute.label } as Institute]);
          setValue('instituteId', newInstitute.id, { shouldValidate: true });
        }}
      />
    </div>
  );
}

