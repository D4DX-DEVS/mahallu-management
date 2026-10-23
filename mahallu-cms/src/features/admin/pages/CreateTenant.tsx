import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Alert from '@/components/ui/Alert';
import { tenantService } from '@/services/tenantService';
import { demoRequestService, requestStatus, type DemoRequest } from '@/services/demoRequestService';
import { TENANT_TYPE_OPTIONS } from '@/constants/tenantTypes';import { formatPhoneNumber } from '@/utils/format';
import { loadErrorMessage } from '@/utils/errors';
import { STATES, getDistrictsByState } from '@/constants/locations';
import PageHeader from '@/components/layout/PageHeader';
import { toast } from '@/store/toastStore';
import { errorMessage } from '@/utils/errors';
import { optionalPinCodeSchema, sanitizeDigits } from '@/utils/validation';

const tenantSchema = z.object({
  name: z.string().max(200, 'Please keep the name to 200 characters or less.').min(1, 'Name is required'),
  code: z.string().max(200, 'Please keep the code to 200 characters or less.').min(1, 'Code is required').toUpperCase(),
  type: z.enum(['mahallu', 'juma_masjid']),
  location: z.string().max(300, 'Please keep the location to 300 characters or less.').min(1, 'Location is required'),
  address: z.object({
    state: z.string().max(200, 'Please keep the state to 200 characters or less.').min(1, 'State is required'),
    district: z.string().max(200, 'Please keep the district to 200 characters or less.').min(1, 'District is required'),
    pinCode: optionalPinCodeSchema,
    postOffice: z.string().max(200, 'Please keep the post office to 200 characters or less.').optional(),
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

/** The accepted demo request this form was opened from (?demoRequest=<id>), if any. */
type SourceRequest =
  | { phase: 'none' }
  | { phase: 'loading' }
  | { phase: 'ready'; request: DemoRequest }
  | { phase: 'blocked'; message: string };

export default function CreateTenant() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const demoRequestId = searchParams.get('demoRequest');
  const [source, setSource] = useState<SourceRequest>(demoRequestId ? { phase: 'loading' } : { phase: 'none' });
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TenantFormData>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      type: 'mahallu',
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

  // Opened from an accepted demo request: fill in what the request carried. Nothing is created
  // until the administrator reviews the form and submits it.
  useEffect(() => {
    if (!demoRequestId) return;
    let cancelled = false;
    setSource({ phase: 'loading' });
    demoRequestService
      .getById(demoRequestId)
      .then((request) => {
        if (cancelled) return;
        if (requestStatus(request) !== 'accepted') {
          setSource({ phase: 'blocked', message: 'Only an accepted request can be turned into a Mahall. Please accept it first.' });
        } else if (request.tenantId) {
          setSource({ phase: 'blocked', message: 'A Mahall has already been created from this request.' });
        } else {
          setSource({ phase: 'ready', request });
        }
      })
      .catch((error) => {
        if (!cancelled) setSource({ phase: 'blocked', message: loadErrorMessage(error, 'that demo request') });
      });
    return () => {
      cancelled = true;
    };
  }, [demoRequestId]);

  const sourceRequest = source.phase === 'ready' ? source.request : null;
  useEffect(() => {
    if (!sourceRequest) return;
    const fill = <K extends Parameters<typeof setValue>[0]>(field: K, value: unknown) => {
      if (value) setValue(field, value as never, { shouldDirty: true });
    };
    fill('name', sourceRequest.mahalluName);
    fill('type', sourceRequest.type);
    fill('location', sourceRequest.location);
    fill('address.state', sourceRequest.address?.state);
    fill('address.district', sourceRequest.address?.district);
    fill('address.pinCode', sourceRequest.address?.pinCode);
    fill('address.postOffice', sourceRequest.address?.postOffice);
    fill('address.village', sourceRequest.address?.village);
  }, [sourceRequest, setValue]);

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
      await tenantService.create(demoRequestId ? { ...data, demoRequestId } : data);
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

      {source.phase === 'blocked' && (
        <Alert variant="error" title="This request can't be used" className="mb-4">
          {source.message}
        </Alert>
      )}
      {sourceRequest && (
        <Alert variant="info" title={`Creating a Mahall from the request by ${sourceRequest.mahalluName}`} className="mb-4">
          The details below came from the request. Review and edit them, then submit to create the Mahall. Contact:{' '}
          {formatPhoneNumber(sourceRequest.contactNumber)}, WhatsApp: {formatPhoneNumber(sourceRequest.whatsappNumber)}.
        </Alert>
      )}

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
                options={[...TENANT_TYPE_OPTIONS]}
                {...register('type')}
                error={errors.type?.message}
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
                type="text"
                inputMode="numeric"
                maxLength={6}
                {...register('address.pinCode')}
                onChange={(e) => setValue('address.pinCode', sanitizeDigits(e.target.value, 6), { shouldValidate: true, shouldDirty: true })}
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
            <Button
              type="submit"
              isLoading={isSubmitting}
              disabled={source.phase === 'loading' || source.phase === 'blocked'}
            >
              <FiSave className="h-4 w-4 mr-2" />
              Create Tenant
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
