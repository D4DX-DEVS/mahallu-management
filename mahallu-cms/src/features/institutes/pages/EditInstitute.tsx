import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
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

export default function EditInstitute() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<InstituteFormData>({
    mode: 'onTouched',
    resolver: zodResolver(instituteSchema),
  });
  const guard = useUnsavedChangesGuard(isDirty);

  useEffect(() => {
    if (id) {
      fetchInstitute();
    }
  }, [id]);

  const fetchInstitute = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const institute = await instituteService.getById(id);
      setValue('name', institute.name);
      setValue('place', institute.place);
      setValue('type', institute.type as any);
      setValue('joinDate', institute.joinDate ? new Date(institute.joinDate).toISOString().split('T')[0] : '');
      setValue('description', institute.description || '');
      setValue('contactNo', institute.contactNo || '');
      setValue('email', institute.email || '');
      setValue('status', institute.status || 'active');
      setValue('nameMl', institute.nameMl || '');
      setValue('placeMl', institute.placeMl || '');
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load institute. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: InstituteFormData) => {
    if (!id) return;
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

      await instituteService.update(id, instituteData);
      navigate(ROUTES.INSTITUTES.LIST);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't update institute. Try again in a moment."));
      console.error('Error updating institute:', err);
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
      <PageHeader title="Edit Institute" description="Update institute information" />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}

          <Card padding="lg">
          <h3 className="text-sm font-bold text-primary-700 dark:text-surface-text">Institute details</h3>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Name, type and contact information</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Name" {...register('name')} error={errors.name?.message} required />
            <div className="hidden"><Input label="Name (Malayalam)" {...register('nameMl')} placeholder="സ്ഥാപനത്തിന്റെ പേര്" className="font-malayalam" /></div>
            <Input label="Place" {...register('place')} error={errors.place?.message} required />
            <div className="hidden"><Input label="Place (Malayalam)" {...register('placeMl')} placeholder="സ്ഥലം" className="font-malayalam" /></div>
            <Select
              label="Type"
              {...register('type')}
              error={errors.type?.message}
              options={[
                { value: 'institute', label: 'Institute' },
                { value: 'madrasa', label: 'Madrasa' },
                { value: 'orphanage', label: 'Orphanage' },
                { value: 'hospital', label: 'Hospital' },
                { value: 'other', label: 'Other' },
              ]}
            />
            <Input label="Join Date" type="date" {...register('joinDate')} error={errors.joinDate?.message} />
            <PhoneInput label="Contact No" {...register('contactNo')} error={errors.contactNo?.message} />
            <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
            <Select
              label="Status"
              {...register('status')}
              error={errors.status?.message}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
            <div className="md:col-span-2">
              <Input label="Description" {...register('description')} error={errors.description?.message} />
            </div>
          </div>
          </Card>

          <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none rounded-b-card border-t border-line bg-white/90 px-4 py-3 backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button type="button" variant="outline" onClick={() => guard.guardedNavigate(ROUTES.INSTITUTES.LIST)}>
              <FiX className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <FiSave className="h-3.5 w-3.5" />
              {isSubmitting ? 'Updating...' : 'Update Institute'}
            </Button>
          </div>
        </div>
      </form>
      <UnsavedChangesDialog guard={guard} />
    </div>
  );
}

