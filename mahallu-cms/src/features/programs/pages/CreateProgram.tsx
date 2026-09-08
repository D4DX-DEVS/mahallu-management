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
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const programSchema = z.object({
  name: z.string().max(200, 'Please keep the name to 200 characters or less.').min(1, 'Name is required'),
  nameMl: z.string().max(200, 'Please keep the name to 200 characters or less.').optional(),
  place: z.string().max(300, 'Please keep the place to 300 characters or less.').min(1, 'Place is required'),
  placeMl: z.string().max(300, 'Please keep the place to 300 characters or less.').optional(),
  joinDate: z.string().max(200, 'Please keep the join date to 200 characters or less.').min(1, 'Join Date is required'),
  description: z.string().max(3000, 'Please keep the description to 3000 characters or less.').optional(),
  contactNo: z
    .string()
    .regex(/^[0-9]{10,11}$/, 'Contact number must be 10 or 11 digits')
    .optional()
    .or(z.literal('')),
  email: z.string().max(254, 'Please keep the email to 254 characters or less.').email('Invalid email').optional().or(z.literal('')),
  address: z
    .object({
      state: z.string().max(200, 'Please keep the state to 200 characters or less.').optional(),
      district: z.string().max(200, 'Please keep the district to 200 characters or less.').optional(),
      pinCode: z.string().max(200, 'Please keep the pin code to 200 characters or less.').optional(),
      postOffice: z.string().max(200, 'Please keep the post office to 200 characters or less.').optional(),
    })
    .optional(),
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
    formState: { errors, isSubmitting },
  } = useForm<ProgramFormData>({
    resolver: zodResolver(programSchema),
    defaultValues: {
      status: 'active',
      joinDate: new Date().toISOString().split('T')[0],
    },
  });

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
        contactNo: data.contactNo || undefined,
        email: data.email || undefined,
        status: data.status || 'active',
        audience: data.audience,
        programType: data.programType,
      };

      if (data.address?.state || data.address?.district) {
        programData.address = data.address;
      }

      await programService.create(programData);
      navigate(ROUTES.PROGRAMS.LIST);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'create program. please try again' }));
      console.error('Error creating program:', err);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Program"
        description="Add a new program"
        breadcrumbs={[{ label: 'Programs', path: ROUTES.PROGRAMS.LIST }]}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
              {error}
            </div>
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
            <Input label="Contact No." type="tel" {...register('contactNo')} placeholder="Contact Number" />
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

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.PROGRAMS.LIST)}>
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-4 w-4 mr-2" />
              Create Program
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
