import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { ROUTES } from '@/constants/routes';
import { userService } from '@/services/userService';
import {
  SENSITIVE_MODULE_KEYS,
  SENSITIVE_MODULE_LABELS,
  SensitiveModuleKey,
} from '@/constants/modules';
import Alert from '@/components/ui/Alert';
import PageHeader from '@/components/ui/PageHeader';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import UnsavedChangesDialog from '@/components/ui/UnsavedChangesDialog';
import PhotoUpload from '@/components/ui/PhotoUpload';
import PhoneInput from '@/components/ui/PhoneInput';
import PermissionsSection from '../components/PermissionsSection';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const userSchema = z.object({
  name: z.string().min(1, 'Full Name is required'),
  nameMl: z.string().optional(),
  photoUrl: z.string().optional(),
  phone: z.string().min(10, 'Phone Number is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  status: z.enum(['active', 'inactive']),
  permissions: z.object({
    view: z.boolean().default(false),
    add: z.boolean().default(false),
    edit: z.boolean().default(false),
    delete: z.boolean().default(false),
    sensitiveModules: z.array(z.enum(SENSITIVE_MODULE_KEYS)).default([]),
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

export default function EditMahallUser() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UserFormData>({
    mode: 'onTouched',
    resolver: zodResolver(userSchema),
  });
  const guard = useUnsavedChangesGuard(isDirty);

  const permissions = watch('permissions');
  const sensitiveModules = watch('permissions.sensitiveModules') ?? [];

  const fetchUser = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const user = await userService.getById(id);
      setValue('name', user.name);
      setValue('nameMl', user.nameMl || '');
      setValue('photoUrl', user.photoUrl || '');
      setValue('phone', user.phone);
      setValue('email', user.email || '');
      setValue('status', user.status);
      setValue('permissions', {
        view: user.permissions?.view ?? false,
        add: user.permissions?.add ?? false,
        edit: user.permissions?.edit ?? false,
        delete: user.permissions?.delete ?? false,
        sensitiveModules: user.permissions?.sensitiveModules ?? [],
        // Left undefined when never set, so untouched flags keep following the role default
        canDeleteReceipts: user.permissions?.canDeleteReceipts,
        canCancelReceipts: user.permissions?.canCancelReceipts,
        canApprovePayments: user.permissions?.canApprovePayments,
        canCloseCashDay: user.permissions?.canCloseCashDay,
        canVerifyCashDay: user.permissions?.canVerifyCashDay,
        canManageCampaigns: user.permissions?.canManageCampaigns,
        canManagePeriods: user.permissions?.canManagePeriods,
      });
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load user. Refresh the page or try again."));
      console.error('Error fetching user:', err);
    } finally {
      setLoading(false);
    }
  }, [id, setValue]);

  useEffect(() => {
    if (id) {
      fetchUser();
    }
  }, [id, fetchUser]);

  const onSubmit = async (data: UserFormData) => {
    if (!id) return;
    try {
      setError(null);
      await userService.update(id, data);
      // Navigate based on the current route
      if (location.pathname.includes('/admin/users')) {
        navigate('/admin/users');
      } else {
        navigate(ROUTES.USERS.MAHALL);
      }
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't update user. Try again in a moment."));
      console.error('Error updating user:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error && !loading) {
    return (
      <div className="space-y-4">
        <Card>
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <Button onClick={fetchUser} variant="secondary" className="mr-2">
              Retry
            </Button>
            <Button
              onClick={() => guard.guardedNavigate(location.pathname.includes('/admin/users') ? '/admin/users' : ROUTES.USERS.MAHALL)}
              variant="secondary"
            >
              Back to Users
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      <PageHeader title="Edit Mahall User" description="Update user information and permissions" />

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
              <div className="md:col-span-2">
                <PhotoUpload name={watch('name')} value={watch('photoUrl')} onChange={(url) => setValue('photoUrl', url, { shouldDirty: true })} />
              </div>
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
                placeholder="Phone Number"
              />
              <Input
                label="Email"
                type="email"
                {...register('email')}
                error={errors.email?.message}
                placeholder="Email (Optional)"
                className="md:col-span-2"
              />
              <div className="md:col-span-2">
                <label className={labelClasses}>
                  Status
                </label>
                <select
                  {...register('status')}
                  className={`${controlClasses} h-9`}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
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

          {/* Sensitive modules */}
          <Card>
            <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text mb-2">
              Sensitive Module Access
            </h2>
            <p className="text-sm text-[#7B8983] dark:text-surface-muted mb-4">
              Confidential records. Grant only to staff who handle these cases — without a tick the module
              stays hidden and the API refuses access.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SENSITIVE_MODULE_KEYS.map((key) => (
                <label
                  key={key}
                  className="flex items-center space-x-3 p-3 border border-line rounded-xl cursor-pointer hover:bg-mint/40 dark:border-surface-border dark:hover:bg-surface-hover"
                >
                  <input
                    type="checkbox"
                    checked={sensitiveModules.includes(key)}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...sensitiveModules, key]
                        : sensitiveModules.filter((m: SensitiveModuleKey) => m !== key);
                      setValue('permissions.sensitiveModules', next, { shouldDirty: true });
                    }}
                    className="h-4 w-4 cursor-pointer rounded border-line-strong accent-primary-700 dark:accent-brand-lime"
                  />
                  <span className="text-sm font-medium text-[#3A4741] dark:text-surface-text">
                    {SENSITIVE_MODULE_LABELS[key]}
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
              onClick={() => guard.guardedNavigate(location.pathname.includes('/admin/users') ? '/admin/users' : ROUTES.USERS.MAHALL)}
            >
              <FiX className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-3.5 w-3.5" />
              Update User
            </Button>
          </div>
        </div>
      </form>
      <UnsavedChangesDialog guard={guard} />
    </div>
  );
}

