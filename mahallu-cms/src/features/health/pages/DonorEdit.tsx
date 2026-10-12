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

const donorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  bloodGroup: z.string().min(1, 'Blood group is required'),
  contactNo: z.string().min(1, 'Contact number is required'),
  availability: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(['active', 'inactive']),
});

type DonorFormData = z.infer<typeof donorSchema>;

export default function DonorEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const bloodGroups = ['A +ve', 'A -ve', 'B +ve', 'B -ve', 'AB +ve', 'AB -ve', 'O +ve', 'O -ve'];

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<DonorFormData>({
    resolver: zodResolver(donorSchema),
  });

  useEffect(() => {
    const fetchDonor = async () => {
      try {
        if (!id) return;
        const response = await getHealthResourceById(id);
        const donor = response.data;
        setValue('name', donor.name);
        setValue('bloodGroup', donor.bloodGroup || '');
        setValue('contactNo', donor.contactNo);
        setValue('availability', donor.availability || '');
        setValue('notes', donor.notes || '');
        setValue('status', donor.status);
      } catch (err: any) {
        setError("Couldn't load blood donor. Refresh the page or try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchDonor();
  }, [id, setValue]);

  const onSubmit = async (data: DonorFormData) => {
    try {
      setError('');
      setSubmitting(true);
      if (!id) return;
      await updateHealthResource(id, data);
      navigate('/health/donors');
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't update blood donor. Try again in a moment."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Edit blood donor" description="Update the donor details" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Donor details</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Blood group, contact and status</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Name *"
              {...register('name')}
              error={errors.name?.message}
            />
            <Select
              label="Blood Group *"
              options={[{ value: '', label: 'Select blood group' }, ...bloodGroups.map((bg) => ({ value: bg, label: bg }))]}
              value={watch('bloodGroup') || ''}
              error={errors.bloodGroup?.message}
              {...register('bloodGroup')}
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
          <Button type="button" variant="secondary" onClick={() => navigate('/health/donors')} disabled={submitting}>
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
