import { useEffect } from 'react';
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
import { tenantService } from '@/services/tenantService';
import { CLASSIFICATION_OPTIONS, TENANT_CLASSIFICATIONS } from '@/constants/modules';
import { STATES, getDistrictsByState } from '@/constants/locations';

const tenantSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required').toUpperCase(),
  type: z.enum(['standard', 'premium', 'enterprise']),
  classification: z.enum(TENANT_CLASSIFICATIONS),
  location: z.string().min(1, 'Location is required'),
  address: z.object({
    state: z.string().min(1, 'State is required'),
    district: z.string().min(1, 'District is required'),
    pinCode: z.string().optional(),
    postOffice: z.string().optional(),
    lsgName: z.string().min(1, 'LSG Name is required'),
    village: z.string().min(1, 'Village is required'),
  }),
  subscription: z.object({
    plan: z.string().default('basic'),
  }),
  settings: z.object({
    varisangyaAmount: z.number().min(0, 'Varisangya amount cannot be negative').default(0),
  }),
});

type TenantFormData = z.infer<typeof tenantSchema>;

export default function CreateTenant() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TenantFormData>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      type: 'standard',
      classification: 'fully_functional',
      code: '',
      address: {
        state: 'Kerala',
        district: '',
      },
      subscription: {
        plan: 'basic',
      },
      settings: {
        varisangyaAmount: 0,
      },
    },
  });

  // Auto-generate a unique tenant code on mount
  useEffect(() => {
    const generateCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      const prefix = 'TN';
      const random = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      return `${prefix}${random}`;
    };
    setValue('code', generateCode());
  }, [setValue]);

  // Watch state changes to update districts
  const selectedState = watch('address.state');
  
  // Get districts based on selected state
  const districtOptions = selectedState ? getDistrictsByState(selectedState) : [];
  
  // Reset district when state changes
  const handleStateChange = (value: string) => {
    setValue('address.state', value);
    setValue('address.district', ''); // Reset district when state changes
  };

  const onSubmit = async (data: TenantFormData) => {
    try {
      await tenantService.create(data);
      navigate('/admin/tenants');
    } catch (error) {
      console.error('Error creating tenant:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Create Tenant
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Add a new tenant (Mahall) to the system
          </p>
        </div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Admin', path: '/admin/tenants' },
            { label: 'Create Tenant' },
          ]}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Basic Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Tenant Name"
                {...register('name')}
                error={errors.name?.message}
                required
                placeholder="Masjidul Ansar Thiruvizhamkunnu"
              />
              <Input
                label="Code (Auto-generated)"
                {...register('code')}
                error={errors.code?.message}
                required
                placeholder="TN4X8K2M"
              />
              <Select
                label="Type"
                options={[
                  { value: 'standard', label: 'Standard' },
                  { value: 'premium', label: 'Premium' },
                  { value: 'enterprise', label: 'Enterprise' },
                ]}
                {...register('type')}
                error={errors.type?.message}
                required
              />
              <Select
                label="Mahallu Classification"
                options={[...CLASSIFICATION_OPTIONS]}
                {...register('classification')}
                error={errors.classification?.message}
                required
              />
              <Input
                label="Location"
                {...register('location')}
                error={errors.location?.message}
                required
                placeholder="Thiruvizhamkunnu"
              />
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Address
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="State"
                options={STATES}
                {...register('address.state', {
                  onChange: (e) => handleStateChange(e.target.value),
                })}
                error={errors.address?.state?.message}
                required
              />
              <Select
                label="District"
                options={[
                  { value: '', label: 'Select district...' },
                  ...districtOptions,
                ]}
                {...register('address.district')}
                error={errors.address?.district?.message}
                required
                disabled={!selectedState || districtOptions.length === 0}
              />
              <Input
                label="Pin Code"
                {...register('address.pinCode')}
                error={errors.address?.pinCode?.message}
                placeholder="678601"
              />
              <Input
                label="Post Office"
                {...register('address.postOffice')}
                error={errors.address?.postOffice?.message}
                placeholder="Thiruvizhamkunnu"
              />
              <Input
                label="LSG Name"
                {...register('address.lsgName')}
                error={errors.address?.lsgName?.message}
                required
                placeholder="Koodali"
              />
              <Input
                label="Village"
                {...register('address.village')}
                error={errors.address?.village?.message}
                required
                placeholder="Kottoppadam-I"
              />
            </div>
          </div>

          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Settings
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Varisangya Amount"
                type="number"
                min={0}
                {...register('settings.varisangyaAmount', { valueAsNumber: true })}
                error={errors.settings?.varisangyaAmount?.message}
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/admin/tenants')}
            >
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-4 w-4 mr-2" />
              Create Tenant
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}

