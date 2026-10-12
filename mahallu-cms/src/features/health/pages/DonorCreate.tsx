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
import Select from '@/components/ui/Select';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const donorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  bloodGroup: z.string().min(1, 'Blood group is required'),
  contactNo: z.string().min(1, 'Contact number is required'),
  availability: z.string().optional(),
  notes: z.string().optional(),
});

type DonorFormData = z.infer<typeof donorSchema>;

export default function DonorCreate() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<DonorFormData>({
    resolver: zodResolver(donorSchema),
  });

  const bloodGroups = ['A +ve', 'A -ve', 'B +ve', 'B -ve', 'AB +ve', 'AB -ve', 'O +ve', 'O -ve'];

  const onSubmit = async (data: DonorFormData) => {
    try {
      setError('');
      setLoading(true);
      await createHealthResource({
        type: 'blood_donor',
        ...data,
        status: 'active',
      });
      navigate('/health/donors');
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create blood donor. Check the details and try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Add new blood donor" description="Add a donor to the blood donor registry" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Donor details</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Blood group and contact</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Name *"
              {...register('name')}
              placeholder="Donor's full name"
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
          <Button type="button" variant="secondary" onClick={() => navigate('/health/donors')} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Donor'}
          </Button>
        </div>
      </form>
    </div>
  );
}
