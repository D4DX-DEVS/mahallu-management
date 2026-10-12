import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { ROUTES } from '@/constants/routes';
import { instituteService } from '@/services/instituteService';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import UnsavedChangesDialog from '@/components/ui/UnsavedChangesDialog';
import PhoneInput from '@/components/ui/PhoneInput';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const instituteSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  nameMl: z.string().optional(),
  place: z.string().min(1, 'Place is required'),
  placeMl: z.string().optional(),
  type: z.enum(['institute', 'madrasa', 'orphanage', 'hospital', 'other']),
  joinDate: z.string().min(1, 'Join Date is required'),
  description: z.string().optional(),
  contactNo: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  status: z.enum(['active', 'inactive']).optional(),
});

type InstituteFormData = z.infer<typeof instituteSchema>;

export default function CreateInstitute() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<InstituteFormData>({
    mode: 'onTouched',
    resolver: zodResolver(instituteSchema),
    defaultValues: {
      type: 'institute',
      status: 'active',
      joinDate: new Date().toISOString().split('T')[0],
    },
  });
  const guard = useUnsavedChangesGuard(isDirty);

  const onSubmit = async (data: InstituteFormData) => {
    try {
      setError(null);
      const instituteData: any = {
        name: data.name,
        nameMl: data.nameMl,
        place: data.place,
        placeMl: data.placeMl,
        type: data.type,
        joinDate: data.joinDate,
        description: data.description,
        contactNo: data.contactNo,
        email: data.email || undefined,
        status: data.status || 'active',
      };

      await instituteService.create(instituteData);
      navigate(ROUTES.INSTITUTES.LIST);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create institute. Check the details and try again."));
      console.error('Error creating institute:', err);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Create Institute" description="Add a new institute" />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}

          <Card padding="lg">
          <h3 className="text-sm font-bold text-primary-700 dark:text-surface-text">Institute details</h3>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Name, type and contact information</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Name"
              {...register('name')}
              error={errors.name?.message}
              required
              placeholder="Institute Name"
              className="md:col-span-2"
            />
            <div className="hidden">
            <Input
              label="Name (Malayalam)"
              {...register('nameMl')}
              placeholder="സ്ഥാപനത്തിന്റെ പേര്"
              className="md:col-span-2 font-malayalam"
            />
            </div>
            <Select
              label="Type"
              options={[
                { value: 'institute', label: 'Institute' },
                { value: 'madrasa', label: 'Madrasa' },
                { value: 'orphanage', label: 'Orphanage' },
                { value: 'hospital', label: 'Hospital' },
                { value: 'other', label: 'Other' },
              ]}
              {...register('type')}
              error={errors.type?.message}
              required
            />
            <Input
              label="Place"
              {...register('place')}
              error={errors.place?.message}
              required
              placeholder="Place"
            />
            <div className="hidden">
            <Input
              label="Place (Malayalam)"
              {...register('placeMl')}
              placeholder="സ്ഥലം"
              className="font-malayalam"
            />
            </div>
            <Input
              label="Join Date"
              type="date"
              {...register('joinDate')}
              error={errors.joinDate?.message}
              required
            />
            <PhoneInput
              label="Contact No."
              {...register('contactNo')}
              placeholder="Contact Number"
            />
            <Input
              label="Email"
              type="email"
              {...register('email')}
              error={errors.email?.message}
              placeholder="Email (Optional)"
            />
            <Input
              label="Description"
              {...register('description')}
              placeholder="Description"
              className="md:col-span-2"
            />
            <Select
              label="Status"
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              {...register('status')}
              className="md:col-span-2"
            />
          </div>
          </Card>

          <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none rounded-b-card border-t border-line bg-white/90 px-4 py-3 backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button
              type="button"
              variant="outline"
              onClick={() => guard.guardedNavigate(ROUTES.INSTITUTES.LIST)}
            >
              <FiX className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-3.5 w-3.5" />
              Create Institute
            </Button>
          </div>
        </div>
      </form>
      <UnsavedChangesDialog guard={guard} />
    </div>
  );
}

