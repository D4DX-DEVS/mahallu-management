import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createHealthResource } from '@/services/healthService';
import Button from '@/components/ui/Button';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const doctorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  specialty: z.string().optional(),
  contactNo: z.string().min(1, 'Contact number is required'),
  availability: z.string().optional(),
  notes: z.string().optional(),
});

type DoctorFormData = z.infer<typeof doctorSchema>;

export default function DoctorCreate() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DoctorFormData>({
    resolver: zodResolver(doctorSchema),
  });

  const onSubmit = async (data: DoctorFormData) => {
    try {
      setError('');
      setLoading(true);
      await createHealthResource({
        type: 'doctor',
        ...data,
        status: 'active',
      });
      navigate('/health/doctors');
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create doctor. Check the details and try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Add new doctor" description="Add a doctor to the directory" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Doctor details</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Contact and availability</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Name *"
              {...register('name')}
              placeholder="Doctor's full name"
              error={errors.name?.message}
            />
            <Input
              label="Specialty"
              {...register('specialty')}
              placeholder="e.g., Cardiology, Orthopedics"
              error={errors.specialty?.message}
            />
            <Input
              label="Contact Number *"
              {...register('contactNo')}
              placeholder="Phone number"
              type="tel"
              error={errors.contactNo?.message}
            />
            <Input
              label="Availability"
              {...register('availability')}
              placeholder="e.g., Weekdays 9AM-5PM"
              error={errors.availability?.message}
            />
            <div className="md:col-span-2">
              <label htmlFor="health-notes" className={labelClasses}>Notes</label>
              <textarea
                id="health-notes"
                {...register('notes')}
                placeholder="Additional information..."
                rows={4}
                className={`${controlClasses} py-2`}
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/health/doctors')} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Doctor'}
          </Button>
        </div>
      </form>
    </div>
  );
}
