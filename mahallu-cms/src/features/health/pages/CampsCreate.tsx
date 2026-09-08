import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiArrowLeft } from 'react-icons/fi';
import { createMedicalCamp } from '@/services/healthService';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const campSchema = z.object({
  name: z.string().max(200, 'Please keep the name to 200 characters or less.').min(1, 'Camp name is required'),
  campDate: z.string().max(200, 'Please keep the camp date to 200 characters or less.').min(1, 'Camp date is required'),
  location: z.string().max(300, 'Please keep the location to 300 characters or less.').min(1, 'Location is required'),
  organizer: z.string().max(200, 'Please keep the organizer to 200 characters or less.').optional(),
  attendeeCount: z.coerce.number().optional(),
  notes: z.string().max(2000, 'Please keep the notes to 2000 characters or less.').optional(),
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
      setError(errorMessage(err, { action: 'create medical camp' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="max-w-2xl">
        <button
          onClick={() => navigate('/health/camps')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
        >
          <FiArrowLeft /> Back to Camps
        </button>

        <PageHeader title="Create Medical Camp" />
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">Camp Name *</label>
              <Input
                {...register('name')}
                placeholder="Name of the medical camp"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <span className="text-red-500 text-sm">{errors.name.message}</span>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Camp Date *</label>
              <Input
                {...register('campDate')}
                type="date"
                className={errors.campDate ? 'border-red-500' : ''}
              />
              {errors.campDate && <span className="text-red-500 text-sm">{errors.campDate.message}</span>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Location *</label>
              <Input
                {...register('location')}
                placeholder="Camp location"
                className={errors.location ? 'border-red-500' : ''}
              />
              {errors.location && <span className="text-red-500 text-sm">{errors.location.message}</span>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Organizer</label>
              <Input {...register('organizer')} placeholder="Organization name" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Attendee Count</label>
              <Input {...register('attendeeCount')} type="number" placeholder="Number of attendees" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              aria-label="Notes"
              {...register('notes')}
              placeholder="Additional information about the camp..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap gap-4 pt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/health/camps')}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Camp'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
