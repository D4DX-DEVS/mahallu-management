import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiSave, FiX } from 'react-icons/fi';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { instituteService } from '@/services/instituteService';

const instituteSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  place: z.string().min(1, 'Place is required'),
  type: z.enum(['institute', 'madrasa', 'orphanage', 'hospital', 'other']),
  joinDate: z.string().min(1, 'Join Date is required'),
  contactNo: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
});

type InstituteFormData = z.infer<typeof instituteSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (institute: { id: string; label: string }) => void;
}

export default function QuickAddInstitute({ open, onClose, onCreated }: Props) {
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

  const onSubmit = async (data: InstituteFormData) => {
    try {
      setError(null);
      const created = await instituteService.create({
        name: data.name,
        place: data.place,
        type: data.type,
        joinDate: data.joinDate,
        contactNo: data.contactNo,
        email: data.email || undefined,
        description: data.description,
        status: data.status || 'active',
      });
      onCreated({ id: created.id, label: created.name });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create institute. Please try again.');
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Add New Institute" size="lg">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
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

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="outline" onClick={onClose}>
            <FiX className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            <FiSave className="h-4 w-4 mr-2" />
            Create Institute
          </Button>
        </div>
      </form>
    </Modal>
  );
}
