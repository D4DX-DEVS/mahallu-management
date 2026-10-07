import { useState, ChangeEvent } from 'react';
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
import { instituteService } from '@/services/instituteService';
import { toast } from '@/store/toastStore';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const instituteSchema = z.object({
  name: z
    .string()
    .max(200, 'Please keep the name to 200 characters or less.')
    .min(1, 'Name is required')
    .regex(/^[^0-9]*$/, 'Name must contain text only.'),
  nameMl: z.string().max(200, 'Please keep the name to 200 characters or less.').optional(),
  place: z
    .string()
    .max(300, 'Please keep the place to 300 characters or less.')
    .min(1, 'Place is required')
    .regex(/^[^0-9]*$/, 'Place must contain text only.'),
  placeMl: z.string().max(300, 'Please keep the place to 300 characters or less.').optional(),
  type: z.enum(['institute', 'madrasa', 'orphanage', 'hospital', 'other']),
  joinDate: z.string().max(200, 'Please keep the join date to 200 characters or less.').min(1, 'Join Date is required'),
  description: z.string().max(3000, 'Please keep the description to 3000 characters or less.').optional(),
  contactNo: z
    .string()
    .max(200, 'Please keep the contact no to 200 characters or less.')
    .regex(/^[0-9]*$/, 'Contact number must contain numbers only.')
    .optional(),
  email: z.string().max(254, 'Please keep the email to 254 characters or less.').email('Invalid email').optional().or(z.literal('')),
  status: z.enum(['active', 'inactive']).optional(),
});

type InstituteFormData = z.infer<typeof instituteSchema>;

export default function CreateInstitute() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InstituteFormData>({
    resolver: zodResolver(instituteSchema),
    defaultValues: {
      type: 'institute',
      status: 'active',
      joinDate: new Date().toISOString().split('T')[0],
    },
  });

  /*
   * Strips non-digit characters as they're typed or pasted, so a pasted
   * "987abc123" lands as "987123" instead of failing validation only at
   * submit time. */
  const contactNoField = register('contactNo');
  const handleContactNoChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.target.value = event.target.value.replace(/\D/g, '');
    contactNoField.onChange(event);
  };

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
      toast.success('Institute created');
      navigate(ROUTES.INSTITUTES.LIST);
    } catch (err: any) {
      const message = errorMessage(err, { action: 'create institute. please try again' });
      setError(message);
      toast.error(message);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Create Institute"
        description="Add a new institute"
        breadcrumbs={[{ label: 'Institutes', path: ROUTES.INSTITUTES.LIST }]}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-4">
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
            <Input
              label="Contact No."
              type="tel"
              inputMode="numeric"
              {...contactNoField}
              onChange={handleContactNoChange}
              error={errors.contactNo?.message}
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

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.INSTITUTES.LIST)}>
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-4 w-4 mr-2" />
              Create Institute
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
