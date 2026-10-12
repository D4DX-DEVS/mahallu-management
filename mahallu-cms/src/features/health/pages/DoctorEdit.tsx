import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { getHealthResourceById, updateHealthResource } from '@/services/healthService';
import Button from '@/components/ui/Button';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const doctorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  specialty: z.string().optional(),
  contactNo: z.string().min(1, 'Contact number is required'),
  availability: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['active', 'inactive']),
});

type DoctorFormData = z.infer<typeof doctorSchema>;

export default function DoctorEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DoctorFormData>({
    resolver: zodResolver(doctorSchema),
  });

  useEffect(() => {
    const fetchDoctor = async () => {
      try {
        if (!id) return;
        const response = await getHealthResourceById(id);
        const doctor = response.data;
        setValue('name', doctor.name);
        setValue('specialty', doctor.specialty || '');
        setValue('contactNo', doctor.contactNo);
        setValue('availability', doctor.availability || '');
        setValue('notes', doctor.notes || '');
        setValue('status', doctor.status);
      } catch (err: any) {
        setError("Couldn't load doctor. Refresh the page or try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchDoctor();
  }, [id, setValue]);

  const onSubmit = async (data: DoctorFormData) => {
    try {
      setError('');
      setSubmitting(true);
      if (!id) return;
      await updateHealthResource(id, data);
      navigate('/health/doctors');
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't update doctor. Try again in a moment."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Edit doctor" description="Update the doctor details" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Doctor details</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Contact, availability and status</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Name *"
              {...register('name')}
              error={errors.name?.message}
            />
            <Input
              label="Specialty"
              {...register('specialty')}
              error={errors.specialty?.message}
            />
            <Input
              label="Contact Number *"
              {...register('contactNo')}
              type="tel"
              error={errors.contactNo?.message}
            />
            <Input
              label="Availability"
              {...register('availability')}
              error={errors.availability?.message}
            />
            <Select
              label="Status"
              options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
              value={watch('status') || ''}
              error={errors.status?.message}
              {...register('status')}
            />
            <div className="md:col-span-2">
              <label htmlFor="health-notes" className={labelClasses}>Notes</label>
              <textarea
                id="health-notes"
                {...register('notes')}
                rows={4}
                className={`${controlClasses} py-2`}
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/health/doctors')} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  );
}
