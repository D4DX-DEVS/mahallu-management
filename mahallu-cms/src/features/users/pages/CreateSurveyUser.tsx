import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { ROUTES } from '@/constants/routes';
import { userService } from '@/services/userService';
import { tenantService } from '@/services/tenantService';
import { useAuthStore } from '@/store/authStore';
import { Tenant } from '@/types/tenant';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const userSchema = z.object({
  name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must not exceed 100 characters'),
  nameMl: z.string().max(200, 'Please keep the name to 200 characters or less.').optional(),
  phone: z.string().max(200, 'Please keep the phone to 200 characters or less.').regex(/^[0-9]{10}$/, 'Phone number must be exactly 10 digits'),
  email: z.string().max(254, 'Please keep the email to 254 characters or less.').email('Invalid email address').optional().or(z.literal('')),
  tenantId: z.string().max(200, 'Please keep the tenant to 200 characters or less.').optional(),
  permissions: z.object({
    view: z.boolean().default(false),
    add: z.boolean().default(false),
    edit: z.boolean().default(false),
    delete: z.boolean().default(false),
  }),
});

type UserFormData = z.infer<typeof userSchema>;

export default function CreateSurveyUser() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const { isSuperAdmin, currentTenantId } = useAuthStore();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UserFormData>({
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
        role: 'survey',
        password: '123456', // Default password
        tenantId: isSuperAdmin ? data.tenantId : undefined,
      });
      navigate(ROUTES.USERS.SURVEY);
    } catch (err: any) {
      console.error('Error creating user:', err);
      console.error('Error response:', err.response?.data);

      // Handle validation errors
      if (err.response?.data?.errors && Array.isArray(err.response.data.errors)) {
        const errorMessages = err.response.data.errors.map((e: any) => e.msg).join(', ');
        setError(`Validation failed: ${errorMessages}`);
      } else {
        setError(errorMessage(err, { action: 'create user. please try again' }));
      }
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        description="Add a new survey user with appropriate permissions"
        title="Create"
        breadcrumbs={[{ label: 'Survey Users', path: ROUTES.USERS.SURVEY }]}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
              {error}
            </div>
          )}
          {/* Basic Information */}
          <div>
            <h2 className="text-lg font-semibold mb-3 text-foreground">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isSuperAdmin && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tenant <span className="text-red-500">*</span>
                  </label>
                  <select
                    aria-label="Tenant"
                    {...register('tenantId')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
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
              <Input
                label="Phone Number"
                type="tel"
                {...register('phone')}
                error={errors.phone?.message}
                required
                placeholder="9876543210"
                pattern="[0-9]{10}"
                maxLength={10}
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
          </div>

          {/* Permissions */}
          <div>
            <h2 className="text-lg font-semibold mb-2 text-foreground">Permissions</h2>
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
                    aria-label="Select row"
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

          {/* Form Actions */}
          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.USERS.SURVEY)}>
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-4 w-4 mr-2" />
              Create User
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
