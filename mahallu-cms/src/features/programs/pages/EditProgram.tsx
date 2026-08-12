import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { ROUTES } from '@/constants/routes';
import { programService } from '@/services/programService';

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
    formState: { errors, isSubmitting },
  } = useForm<ProgramFormData>({
    resolver: zodResolver(programSchema),
  });

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
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load program');
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
      setError(err.response?.data?.message || 'Failed to update program. Please try again.');
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Edit Program</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Update program information</p>
        </div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Programs', path: ROUTES.PROGRAMS.LIST },
            { label: 'Edit' },
          ]}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Name" {...register('name')} error={errors.name?.message} required />
            <div className="hidden"><Input label="Name (Malayalam)" {...register('nameMl')} placeholder="പ്രോഗ്രാമിന്റെ പേര്" className="font-malayalam" /></div>
            <Input label="Place" {...register('place')} error={errors.place?.message} required />
            <div className="hidden"><Input label="Place (Malayalam)" {...register('placeMl')} placeholder="സ്ഥലം" className="font-malayalam" /></div>
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

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.PROGRAMS.LIST)}>
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <FiSave className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Updating...' : 'Update Program'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}

