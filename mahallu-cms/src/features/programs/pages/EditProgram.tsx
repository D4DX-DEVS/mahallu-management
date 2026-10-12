import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
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
  contactNo: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  'address.state': z.string().optional(),
  'address.district': z.string().optional(),
  'address.pinCode': z.string().optional(),
  'address.postOffice': z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  audience: z.enum(['all', 'men', 'women', 'youth', 'children', 'families']).optional(),
  programType: z.enum(['quran_class', 'hadith', 'fiqh', 'lecture', 'family', 'other']).optional(),
  eventDate: z.string().optional(),
  awards: z.string().optional(),
});

type ProgramFormData = z.infer<typeof programSchema>;

export default function EditProgram() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProgramFormData>({
    mode: 'onTouched',
    resolver: zodResolver(programSchema),
  });
  const guard = useUnsavedChangesGuard(isDirty);

  useEffect(() => {
    if (id) {
      fetchProgram();
    }
  }, [id]);

  const fetchProgram = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const program = await programService.getById(id);
      setValue('name', program.name);
      setValue('place', program.place);
      setValue('joinDate', program.joinDate ? new Date(program.joinDate).toISOString().split('T')[0] : '');
      setValue('description', program.description || '');
      setValue('contactNo', program.contactNo || '');
      setValue('email', program.email || '');
      setValue('nameMl', program.nameMl || '');
      setValue('placeMl', program.placeMl || '');
      setValue('status', (program.status || 'active') as 'active' | 'inactive');
      if (program.audience) setValue('audience', program.audience as 'all' | 'men' | 'women' | 'youth' | 'children' | 'families');
      if (program.programType) setValue('programType', program.programType as 'quran_class' | 'hadith' | 'fiqh' | 'lecture' | 'family' | 'other');
      setValue('eventDate', program.eventDate ? new Date(program.eventDate).toISOString().split('T')[0] : '');
      setValue('awards', program.awards || '');
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load program. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: ProgramFormData) => {
    if (!id) return;
    try {
      setError(null);
      const programData: any = {
        name: data.name,
        nameMl: data.nameMl,
        place: data.place,
        placeMl: data.placeMl,
        joinDate: data.joinDate,
        description: data.description,
        contactNo: data.contactNo,
        email: data.email || undefined,
        status: data.status || 'active',
        audience: data.audience,
        programType: data.programType,
        eventDate: data.eventDate || undefined,
        awards: data.awards || undefined,
      };

      if (data['address.state'] || data['address.district']) {
        programData.address = {
          state: data['address.state'],
          district: data['address.district'],
          pinCode: data['address.pinCode'],
          postOffice: data['address.postOffice'],
        };
      }

      await programService.update(id, programData);
      navigate(ROUTES.PROGRAMS.LIST);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't update program. Try again in a moment."));
      console.error('Error updating program:', err);
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
      <PageHeader
        title="Edit Program"
        description="Update program information"
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
            <Input label="Name" {...register('name')} error={errors.name?.message} required />
            <div className="hidden"><Input label="Name (Malayalam)" {...register('nameMl')} placeholder="പ്രോഗ്രാമിന്റെ പേര്" className="font-malayalam" /></div>
            <Input label="Place" {...register('place')} error={errors.place?.message} required />
            <div className="hidden"><Input label="Place (Malayalam)" {...register('placeMl')} placeholder="സ്ഥലം" className="font-malayalam" /></div>
            <Input label="Join Date" type="date" {...register('joinDate')} error={errors.joinDate?.message} />
            <PhoneInput label="Contact No" {...register('contactNo')} error={errors.contactNo?.message} />
            <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
            <Input label="Event Date" type="date" {...register('eventDate')} error={errors.eventDate?.message} />
            <Input label="Awards" {...register('awards')} error={errors.awards?.message} placeholder="e.g. Best participation trophy" />
            <Select
              label="Status"
              {...register('status')}
              error={errors.status?.message}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
            <Select
              label="Audience"
              {...register('audience')}
              error={errors.audience?.message}
              options={[
                { value: 'all', label: 'All' },
                { value: 'men', label: 'Men' },
                { value: 'women', label: 'Women' },
                { value: 'youth', label: 'Youth' },
                { value: 'children', label: 'Children' },
                { value: 'families', label: 'Families' },
              ]}
            />
            <Select
              label="Program Type"
              {...register('programType')}
              error={errors.programType?.message}
              options={[
                { value: 'quran_class', label: 'Quran Class' },
                { value: 'hadith', label: 'Hadith' },
                { value: 'fiqh', label: 'Fiqh' },
                { value: 'lecture', label: 'Lecture' },
                { value: 'family', label: 'Family' },
                { value: 'other', label: 'Other' },
              ]}
            />
            <div className="md:col-span-2">
              <Input label="Description" {...register('description')} error={errors.description?.message} />
            </div>
            <Input label="State" {...register('address.state')} error={errors['address.state']?.message} />
            <Input label="District" {...register('address.district')} error={errors['address.district']?.message} />
            <Input label="PIN Code" {...register('address.pinCode')} error={errors['address.pinCode']?.message} />
            <Input label="Post Office" {...register('address.postOffice')} error={errors['address.postOffice']?.message} />
          </div>

          <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none rounded-b-card border-t border-line bg-white/90 px-4 py-3 backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button type="button" variant="secondary" onClick={() => guard.guardedNavigate(ROUTES.PROGRAMS.LIST)}>
              <FiX className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <FiSave className="h-3.5 w-3.5" />
              {isSubmitting ? 'Updating...' : 'Update Program'}
            </Button>
          </div>
        </Card>
      </form>
      <UnsavedChangesDialog guard={guard} />
    </div>
  );
}

