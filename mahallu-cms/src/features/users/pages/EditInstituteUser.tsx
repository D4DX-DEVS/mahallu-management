import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { ROUTES } from '@/constants/routes';
import { userService } from '@/services/userService';
import { User } from '@/types';
import Alert from '@/components/ui/Alert';
import PageHeader from '@/components/ui/PageHeader';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import UnsavedChangesDialog from '@/components/ui/UnsavedChangesDialog';
import PhotoUpload from '@/components/ui/PhotoUpload';
import PhoneInput from '@/components/ui/PhoneInput';
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
  }),
});

type UserFormData = z.infer<typeof userSchema>;

export default function EditInstituteUser() {
  const navigate = useNavigate();
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

  useEffect(() => {
    if (id) {
      fetchUser();
    }
  }, [id]);

  const fetchUser = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const user = await userService.getById(id);
      setValue('name', user.name);
      setValue('nameMl', user.nameMl || '');
      setValue('photoUrl', user.photoUrl || '');
      setValue('phone', user.phone);
      setValue('email', user.email || '');
      setValue('status', user.status || 'active');
      setValue('permissions', user.permissions || {
        view: false,
        add: false,
        edit: false,
        delete: false,
      });
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load user. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: UserFormData) => {
    if (!id) return;
    try {
      setError(null);
      await userService.update(id, {
        ...data,
        role: 'institute',
      });
      navigate(ROUTES.USERS.INSTITUTE);
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

  return (
    <div className="space-y-4">

      <PageHeader title="Edit Institute User" description="Update institute user information" />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4">
          {error && (
            <Alert tone="danger">{error}</Alert>
          )}
          <Card>
            <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text mb-0.5">Basic Information</h2>
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
                {errors.status && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.status.message}</p>
                )}
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text mb-2">Permissions</h2>
            <p className="text-sm text-[#7B8983] dark:text-surface-muted mb-4">Check The Required Permissions Below</p>
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

          <div className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none rounded-card border border-line bg-white/90 px-4 py-3 shadow-card backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button type="button" variant="secondary" onClick={() => guard.guardedNavigate(ROUTES.USERS.INSTITUTE)}>
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

