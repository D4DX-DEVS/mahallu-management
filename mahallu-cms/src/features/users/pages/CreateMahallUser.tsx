import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import { ROUTES } from '@/constants/routes';
import { userService } from '@/services/userService';
import { tenantService } from '@/services/tenantService';
import { useAuthStore } from '@/store/authStore';
import { Tenant } from '@/types/tenant';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import UnsavedChangesDialog from '@/components/ui/UnsavedChangesDialog';
import PhoneInput from '@/components/ui/PhoneInput';
import PermissionsSection from '../components/PermissionsSection';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const userSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name must not exceed 100 characters'),
  nameMl: z.string().optional(),
  phone: z.string().regex(/^[0-9]{10}$/, 'Phone number must be exactly 10 digits'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  tenantId: z.string().optional(),
  permissions: z.object({
    view: z.boolean().default(false),
    add: z.boolean().default(false),
    edit: z.boolean().default(false),
    delete: z.boolean().default(false),
    canDeleteReceipts: z.boolean().optional(),
    canCancelReceipts: z.boolean().optional(),
    canApprovePayments: z.boolean().optional(),
    canCloseCashDay: z.boolean().optional(),
    canVerifyCashDay: z.boolean().optional(),
    canManageCampaigns: z.boolean().optional(),
    canManagePeriods: z.boolean().optional(),
  }),
});

type UserFormData = z.infer<typeof userSchema>;

export default function CreateMahallUser() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const { isSuperAdmin, currentTenantId } = useAuthStore();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UserFormData>({
    mode: 'onTouched',
    resolver: zodResolver(userSchema),
    defaultValues: {
      tenantId: currentTenantId || '',
      permissions: {
        view: false,
        add: false,
        edit: false,
        delete: false,
      },
    },
  });
  const guard = useUnsavedChangesGuard(isDirty);

  const permissions = watch('permissions');

  useEffect(() => {
    const loadTenants = async () => {
      if (isSuperAdmin) {
        try {
          const result = await tenantService.getAll({ status: 'active' });
          setTenants(result.data);
        } catch (err) {
          console.error('Error loading tenants:', err);
        }
      }
    };
    loadTenants();
  }, [isSuperAdmin]);

  const onSubmit = async (data: UserFormData) => {
    try {
      setError(null);
      
      // Validate tenantId for super admin
      if (isSuperAdmin && !data.tenantId) {
        setError('Please select a tenant');
        return;
      }
      
      await userService.create({
        ...data,
        role: 'mahall',
        password: '123456', // Default password
        tenantId: isSuperAdmin ? data.tenantId : undefined,
      });
      navigate(ROUTES.USERS.MAHALL);
    } catch (err: any) {
      console.error('Error creating user:', err);
      console.error('Error response:', err.response?.data);
      
      // Handle validation errors
      toast.error(getFriendlyError(err, "Couldn't create user. Check the details and try again."));

    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Create Mahall User"
        description="Add a new mahall user with appropriate permissions"
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4">
          {error && (
            <Alert tone="danger">{error}</Alert>
          )}
          {/* Basic Information */}
          <Card>
            <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text mb-0.5">
              Basic Information
            </h2>
            <p className="mb-3 text-xs text-[#7B8983] dark:text-surface-muted">Name and contact details</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isSuperAdmin && (
                <div className="md:col-span-2">
                  <label className={labelClasses}>
                    Tenant <span className="text-red-500">*</span>
                  </label>
                  <select
                    {...register('tenantId')}
                    className={`${controlClasses} h-9`}
                  >
                    <option value="">Select Tenant</option>
                    {tenants.map((tenant) => (
                      <option key={tenant.id} value={tenant.id}>
                        {tenant.name} ({tenant.code})
                      </option>
                    ))}
                  </select>
                  {errors.tenantId && (
                    <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.tenantId.message}</p>
                  )}
                </div>
              )}
      <Input
                label="Full Name"
                {...register('name')}
                error={errors.name?.message}
                required
                placeholder="Full Name"
              />
              <div className="hidden">
              <Input
                label="Full Name (Malayalam)"
                {...register('nameMl')}
                placeholder="പേര്‍"
                className="font-malayalam"
              />
              </div>
              <PhoneInput
                label="Phone Number"
                {...register('phone')}
                error={errors.phone?.message}
                required
                placeholder="9876543210"
                pattern="[0-9]{10}"
                title="Phone number must be exactly 10 digits"
              />
              <Input
                label="Email"
                type="email"
                {...register('email')}
                error={errors.email?.message}
                placeholder="Email (Optional)"
                className="md:col-span-2"
              />
            </div>
          </Card>

          {/* Permissions */}
          <Card>
            <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text mb-2">
              Permissions
            </h2>
            <p className="text-sm text-[#7B8983] dark:text-surface-muted mb-4">
              Check The Required Permissions Below
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'view' as const, label: 'View All Data' },
                { key: 'add' as const, label: 'Add All Data' },
                { key: 'edit' as const, label: 'Edit All Data' },
                { key: 'delete' as const, label: 'Delete All Data' },
              ].map((permission) => (
                <label
                  key={permission.key}
                  className="flex items-center space-x-3 p-3 border border-line rounded-xl cursor-pointer hover:bg-mint/40 dark:border-surface-border dark:hover:bg-surface-hover"
                >
                  <input
                    type="checkbox"
                    {...register(`permissions.${permission.key}`)}
                    className="h-4 w-4 cursor-pointer rounded border-line-strong accent-primary-700 dark:accent-brand-lime"
                  />
                  <span className="text-sm font-medium text-[#3A4741] dark:text-surface-text">
                    {permission.label}
                  </span>
                </label>
              ))}
            </div>
          </Card>

          <PermissionsSection
            values={permissions}
            onChange={(key, value) => setValue(`permissions.${key}`, value, { shouldDirty: true })}
          />

          {/* Form Actions */}
          <div className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none rounded-card border border-line bg-white/90 px-4 py-3 shadow-card backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button
              type="button"
              variant="secondary"
              onClick={() => guard.guardedNavigate(ROUTES.USERS.MAHALL)}
            >
              <FiX className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-3.5 w-3.5" />
              Create User
            </Button>
          </div>
        </div>
      </form>
      <UnsavedChangesDialog guard={guard} />
    </div>
  );
}

