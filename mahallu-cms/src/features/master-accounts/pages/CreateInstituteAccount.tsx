import { useState, useEffect } from 'react';
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
import QuickAddInstitute from '@/components/quick-add/QuickAddInstitute';
import { ROUTES } from '@/constants/routes';
import { masterAccountService } from '@/services/masterAccountService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import { Institute } from '@/types';

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
  const user = useAuthStore((state) => state.user);
  // Institute-role users only ever manage their own institute — the backend forces every
  // account they create onto their own instituteId regardless of what's submitted, so letting
  // them pick a different one here just hid newly created accounts from their own list.
  const isInstituteRole = user?.role === 'institute';
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchInstitutes = async () => {
    try {
      setLoadingInstitutes(true);
      if (isInstituteRole && user?.instituteId) {
        const own = await instituteService.getById(user.instituteId);
        setInstitutes([own]);
        setValue('instituteId', own.id, { shouldValidate: true });
      } else {
        const result = await instituteService.getAll({ status: 'active' });
        setInstitutes(result.data || []);
      }
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
      setError(err.response?.data?.message || 'Failed to create institute account. Please try again.');
      console.error('Error creating institute account:', err);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Institute Accounts', path: ROUTES.MASTER_ACCOUNTS.INSTITUTE_ACCOUNTS },
          { label: 'Create' },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Create Institute Account
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Add a new bank account for an institute
        </p>
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
              <Select
                label="Institute"
                {...register('instituteId')}
                value={watch('instituteId') || ''}
                onAddNew={isInstituteRole ? undefined : () => setAddInstituteOpen(true)}
                addNewLabel="Add Institute"
                error={errors.instituteId?.message}
                disabled={loadingInstitutes || isInstituteRole}
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

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(ROUTES.MASTER_ACCOUNTS.INSTITUTE_ACCOUNTS)}
            >
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <FiSave className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Creating...' : 'Create Account'}
            </Button>
          </div>
        </Card>
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

