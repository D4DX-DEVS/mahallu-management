import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { tenantService } from '@/services/tenantService';
import { CLASSIFICATION_OPTIONS, TENANT_CLASSIFICATIONS } from '@/constants/modules';
import { STATES, getDistrictsByState } from '@/constants/locations';
import PageHeader from '@/components/layout/PageHeader';
import { toast } from '@/store/toastStore';
import { errorMessage } from '@/utils/errors';

const tenantSchema = z.object({
  name: z.string().max(200, 'Please keep the name to 200 characters or less.').min(1, 'Name is required'),
  code: z.string().max(200, 'Please keep the code to 200 characters or less.').min(1, 'Code is required').toUpperCase(),
  type: z.enum(['standard', 'premium', 'enterprise']),
  classification: z.enum(TENANT_CLASSIFICATIONS),
  location: z.string().max(300, 'Please keep the location to 300 characters or less.').min(1, 'Location is required'),
  address: z.object({
    state: z.string().max(200, 'Please keep the state to 200 characters or less.').min(1, 'State is required'),
    district: z.string().max(200, 'Please keep the district to 200 characters or less.').min(1, 'District is required'),
    pinCode: z.string().max(200, 'Please keep the pin code to 200 characters or less.').optional(),
    postOffice: z.string().max(200, 'Please keep the post office to 200 characters or less.').optional(),
    lsgName: z.string().max(200, 'Please keep the lsg name to 200 characters or less.').min(1, 'LSG Name is required'),
    village: z.string().max(200, 'Please keep the village to 200 characters or less.').min(1, 'Village is required'),
  }),
  subscription: z.object({
    plan: z.string().max(200, 'Please keep the plan to 200 characters or less.').default('basic'),
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
      const random = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join(
        ''
      );
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
      toast.error(errorMessage(error, { action: 'create tenant' }));
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Create Tenant"
        description="Add a new tenant (Mahall) to the system"
        breadcrumbs={[{ label: 'Admin', path: '/admin/tenants' }]}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-3 text-foreground">Basic Information</h2>
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
            <h2 className="text-lg font-semibold mb-3 text-foreground">Address</h2>
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
                options={[{ value: '', label: 'Select district...' }, ...districtOptions]}
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
            <h2 className="text-lg font-semibold mb-3 text-foreground">Settings</h2>
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

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate('/admin/tenants')}>
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
