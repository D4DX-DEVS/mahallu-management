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
import PageHeader from '@/components/ui/PageHeader';

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
    <div className="space-y-4">
      <PageHeader
        title="Create Tenant"
        description="Add a new tenant (Mahall) to the system"
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4">
          <Card>
            <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text mb-0.5">
              Basic Information
            </h2>
            <p className="mb-3 text-xs text-[#7B8983] dark:text-surface-muted">Name and contact details</p>
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
          </Card>

          <Card>
            <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text mb-0.5">
              Address
            </h2>
            <p className="mb-3 text-xs text-[#7B8983] dark:text-surface-muted">Where this is located</p>
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
          </Card>

          <Card>
            <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text mb-0.5">
              Settings
            </h2>
            <p className="mb-3 text-xs text-[#7B8983] dark:text-surface-muted">Defaults for this record</p>
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
          </Card>

          <div className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none rounded-card border border-line bg-white/90 px-4 py-3 shadow-card backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/admin/tenants')}
            >
              <FiX className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-3.5 w-3.5" />
              Create Tenant
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

