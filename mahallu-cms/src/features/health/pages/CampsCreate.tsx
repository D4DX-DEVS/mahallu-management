import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createMedicalCamp } from '@/services/healthService';
import Button from '@/components/ui/Button';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const campSchema = z.object({
  name: z.string().min(1, 'Camp name is required'),
  campDate: z.string().min(1, 'Camp date is required'),
  location: z.string().min(1, 'Location is required'),
  organizer: z.string().optional(),
  attendeeCount: z.coerce.number().optional(),
  notes: z.string().optional(),
});

type CampFormData = z.infer<typeof campSchema>;

export default function CampsCreate() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CampFormData>({
    resolver: zodResolver(campSchema),
  });

  const onSubmit = async (data: CampFormData) => {
    try {
      setError('');
      setLoading(true);
      await createMedicalCamp({
        ...data,
        status: 'planned',
      });
      navigate('/health/camps');
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create medical camp. Check the details and try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Create medical camp" description="Plan a new medical camp" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Camp details</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Date, location and organizer</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
            <Input
              label="Camp Name *"
              {...register('name')}
              placeholder="Name of the medical camp"
              error={errors.name?.message}
            />
            </div>
            <Input
              label="Camp Date *"
              {...register('campDate')}
              type="date"
              error={errors.campDate?.message}
            />
            <Input
              label="Location *"
              {...register('location')}
              placeholder="Camp location"
              error={errors.location?.message}
            />
            <Input
              label="Organizer"
              {...register('organizer')}
              placeholder="Organization name"
              error={errors.organizer?.message}
            />
            <Input
              label="Attendee Count"
              {...register('attendeeCount')}
              placeholder="Number of attendees"
              type="number"
              error={errors.attendeeCount?.message}
            />
            <div className="md:col-span-2">
              <label htmlFor="health-notes" className={labelClasses}>Notes</label>
              <textarea
                id="health-notes"
                {...register('notes')}
                placeholder="Additional information about the camp..."
                rows={4}
                className={`${controlClasses} py-2`}
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/health/camps')} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Camp'}
          </Button>
        </div>
      </form>
    </div>
  );
}
