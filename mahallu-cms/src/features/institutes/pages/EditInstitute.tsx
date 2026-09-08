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
import { PageSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/constants/routes';
import { instituteService } from '@/services/instituteService';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const instituteSchema = z.object({
  name: z.string().max(200, 'Please keep the name to 200 characters or less.').min(1, 'Name is required'),
  nameMl: z.string().max(200, 'Please keep the name to 200 characters or less.').optional(),
  place: z.string().max(300, 'Please keep the place to 300 characters or less.').min(1, 'Place is required'),
  placeMl: z.string().max(300, 'Please keep the place to 300 characters or less.').optional(),
  type: z.enum(['institute', 'madrasa', 'orphanage', 'hospital', 'other']),
  joinDate: z.string().max(200, 'Please keep the join date to 200 characters or less.').min(1, 'Join Date is required'),
  description: z.string().max(3000, 'Please keep the description to 3000 characters or less.').optional(),
  contactNo: z.string().max(200, 'Please keep the contact no to 200 characters or less.').optional(),
  email: z.string().max(254, 'Please keep the email to 254 characters or less.').email('Invalid email').optional().or(z.literal('')),
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
    formState: { errors, isSubmitting },
  } = useForm<InstituteFormData>({
    resolver: zodResolver(instituteSchema),
  });

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
      setValue(
        'joinDate',
        institute.joinDate ? new Date(institute.joinDate).toISOString().split('T')[0] : ''
      );
      setValue('description', institute.description || '');
      setValue('contactNo', institute.contactNo || '');
      setValue('email', institute.email || '');
      setValue('status', institute.status || 'active');
      setValue('nameMl', institute.nameMl || '');
      setValue('placeMl', institute.placeMl || '');
    } catch (err: any) {
      setError(loadErrorMessage(err, 'institute'));
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
      setError(errorMessage(err, { action: 'update institute. please try again' }));
      console.error('Error updating institute:', err);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Institute"
        description="Update institute information"
        breadcrumbs={[{ label: 'Institutes', path: ROUTES.INSTITUTES.LIST }]}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Name" {...register('name')} error={errors.name?.message} required />
            <div className="hidden">
              <Input
                label="Name (Malayalam)"
                {...register('nameMl')}
                placeholder="സ്ഥാപനത്തിന്റെ പേര്"
                className="font-malayalam"
              />
            </div>
            <Input label="Place" {...register('place')} error={errors.place?.message} required />
            <div className="hidden">
              <Input
                label="Place (Malayalam)"
                {...register('placeMl')}
                placeholder="സ്ഥലം"
                className="font-malayalam"
              />
            </div>
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
            <Input label="Contact No" {...register('contactNo')} error={errors.contactNo?.message} />
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

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.INSTITUTES.LIST)}>
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <FiSave className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Updating...' : 'Update Institute'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
