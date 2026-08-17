import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/constants/routes';
import { userService } from '@/services/userService';
import {
  SENSITIVE_MODULE_KEYS,
  SENSITIVE_MODULE_LABELS,
  SensitiveModuleKey,
} from '@/constants/modules';

const userSchema = z.object({
  name: z.string().min(1, 'Full Name is required'),
  nameMl: z.string().optional(),
  phone: z.string().min(10, 'Phone Number is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  status: z.enum(['active', 'inactive']),
  permissions: z.object({
    view: z.boolean().default(false),
    add: z.boolean().default(false),
    edit: z.boolean().default(false),
    delete: z.boolean().default(false),
    sensitiveModules: z.array(z.enum(SENSITIVE_MODULE_KEYS)).default([]),
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
    formState: { errors, isSubmitting },
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  });

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
      setValue('phone', user.phone);
      setValue('email', user.email || '');
      setValue('status', user.status);
      setValue('permissions', {
        view: user.permissions?.view ?? false,
        add: user.permissions?.add ?? false,
        edit: user.permissions?.edit ?? false,
        delete: user.permissions?.delete ?? false,
        sensitiveModules: user.permissions?.sensitiveModules ?? [],
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load user');
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
      setError(err.response?.data?.message || 'Failed to update user. Please try again.');
      console.error('Error updating user:', err);
    }
  };

  if (loading) {
    return (
      <PageSkeleton />
    );
  }

  if (error && !loading) {
    return (
      <div className="space-y-6">
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: location.pathname.includes('/admin/users') ? 'All Users' : 'Mahall Users', path: location.pathname.includes('/admin/users') ? '/admin/users' : ROUTES.USERS.MAHALL },
            { label: 'Edit' },
          ]}
        />
        <Card>
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
            <Button onClick={fetchUser} variant="outline" className="mr-2">
              Retry
            </Button>
            <Button
              onClick={() => navigate(location.pathname.includes('/admin/users') ? '/admin/users' : ROUTES.USERS.MAHALL)}
              variant="outline"
            >
              Back to Users
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: location.pathname.includes('/admin/users') ? 'All Users' : 'Mahall Users', path: location.pathname.includes('/admin/users') ? '/admin/users' : ROUTES.USERS.MAHALL },
          { label: 'Edit' },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Edit Mahall User
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Update user information and permissions
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
              {error}
            </div>
          )}

          {/* Basic Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Basic Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              <Input
                label="Phone Number"
                type="tel"
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Status
                </label>
                <select
                  {...register('status')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg dark:border-gray-600 dark:bg-gray-800"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Permissions
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
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
                  className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  <input
                    type="checkbox"
                    {...register(`permissions.${permission.key}`)}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {permission.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Sensitive modules */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Sensitive Module Access
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Confidential records. Grant only to staff who handle these cases — without a tick the module
              stays hidden and the API refuses access.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {SENSITIVE_MODULE_KEYS.map((key) => (
                <label
                  key={key}
                  className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
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
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {SENSITIVE_MODULE_LABELS[key]}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(location.pathname.includes('/admin/users') ? '/admin/users' : ROUTES.USERS.MAHALL)}
            >
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-4 w-4 mr-2" />
              Update User
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}

