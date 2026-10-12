import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { ROUTES } from '@/constants/routes';
import { programService } from '@/services/programService';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import UnsavedChangesDialog from '@/components/ui/UnsavedChangesDialog';
import PhoneInput from '@/components/ui/PhoneInput';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const programSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  nameMl: z.string().optional(),
  place: z.string().min(1, 'Place is required'),
  placeMl: z.string().optional(),
  joinDate: z.string().min(1, 'Join Date is required'),
  description: z.string().optional(),
  contactNo: z.string().regex(/^[0-9]{10,11}$/, 'Contact number must be 10 or 11 digits').optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  'address.state': z.string().optional(),
  'address.district': z.string().optional(),
  'address.pinCode': z.string().optional(),
  'address.postOffice': z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  audience: z.enum(['all', 'men', 'women', 'youth', 'children', 'families']).optional(),
  programType: z.enum(['quran_class', 'hadith', 'fiqh', 'lecture', 'family', 'other']).optional(),
});

type ProgramFormData = z.infer<typeof programSchema>;

export default function CreateProgram() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProgramFormData>({
    mode: 'onTouched',
    resolver: zodResolver(programSchema),
    defaultValues: {
      status: 'active',
      joinDate: new Date().toISOString().split('T')[0],
    },
  });
  const guard = useUnsavedChangesGuard(isDirty);

  const onSubmit = async (data: ProgramFormData) => {
    try {
      setError(null);
      const programData: any = {
        name: data.name,
        nameMl: data.nameMl,
        place: data.place,
        placeMl: data.placeMl,
        type: 'program',
        joinDate: data.joinDate,
        description: data.description,
        contactNo: data.contactNo,
        email: data.email || undefined,
        status: data.status || 'active',
        audience: data.audience,
        programType: data.programType,
      };

      if (data['address.state'] || data['address.district']) {
        programData.address = {
          state: data['address.state'],
          district: data['address.district'],
          pinCode: data['address.pinCode'],
          postOffice: data['address.postOffice'],
        };
      }

      await programService.create(programData);
      navigate(ROUTES.PROGRAMS.LIST);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create program. Check the details and try again."));
      console.error('Error creating program:', err);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Create Program"
        description="Add a new program"
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-6">
          <div>
            <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">Program details</h2>
            <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Name, place, schedule and contact</p>
          </div>
          {error && (
            <Alert tone="danger">{error}</Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Name"
              {...register('name')}
              error={errors.name?.message}
              required
              placeholder="Program Name"
              className="md:col-span-2"
            />
            <div className="hidden">
            <Input
              label="Name (Malayalam)"
              {...register('nameMl')}
              placeholder="പ്രോഗ്രാമിന്റെ പേര്"
              className="md:col-span-2 font-malayalam"
            />
            </div>
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
            <Input label="State" {...register('address.state')} placeholder="State" />
            <Input label="District" {...register('address.district')} placeholder="District" />
            <Input label="Pin Code" {...register('address.pinCode')} placeholder="Pin Code" />
            <Input label="Post Office" {...register('address.postOffice')} placeholder="Post Office" />
            <Select
              label="Status"
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              {...register('status')}
            />
            <Select
              label="Audience"
              options={[
                { value: 'all', label: 'All' },
                { value: 'men', label: 'Men' },
                { value: 'women', label: 'Women' },
                { value: 'youth', label: 'Youth' },
                { value: 'children', label: 'Children' },
                { value: 'families', label: 'Families' },
              ]}
              {...register('audience')}
            />
            <Select
              label="Program Type"
              options={[
                { value: 'quran_class', label: 'Quran Class' },
                { value: 'hadith', label: 'Hadith' },
                { value: 'fiqh', label: 'Fiqh' },
                { value: 'lecture', label: 'Lecture' },
                { value: 'family', label: 'Family' },
                { value: 'other', label: 'Other' },
              ]}
              {...register('programType')}
            />
          </div>

          <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none rounded-b-card border-t border-line bg-white/90 px-4 py-3 backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button type="button" variant="secondary" onClick={() => guard.guardedNavigate(ROUTES.PROGRAMS.LIST)}>
              <FiX className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-3.5 w-3.5" />
              Create Program
            </Button>
          </div>
        </Card>
      </form>
      <UnsavedChangesDialog guard={guard} />
    </div>
  );
}

