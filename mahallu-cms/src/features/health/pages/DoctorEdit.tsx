import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiArrowLeft } from 'react-icons/fi';
import { getHealthResourceById, updateHealthResource } from '@/services/healthService';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const doctorSchema = z.object({
  name: z.string().max(200, 'Please keep the name to 200 characters or less.').min(1, 'Name is required'),
  specialty: z.string().max(200, 'Please keep the specialty to 200 characters or less.').optional(),
  contactNo: z.string().max(200, 'Please keep the contact no to 200 characters or less.').min(1, 'Contact number is required'),
  availability: z.string().max(200, 'Please keep the availability to 200 characters or less.').optional(),
  notes: z.string().max(2000, 'Please keep the notes to 2000 characters or less.').optional(),
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
        setError("Couldn't load doctor");
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
      setError(errorMessage(err, { action: 'update doctor' }));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div>
      <div className="max-w-2xl">
        <button
          onClick={() => navigate('/health/doctors')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-4"
        >
          <FiArrowLeft /> Back to Doctors
        </button>

        <PageHeader title="Edit Doctor" />
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
              <Input {...register('name')} className={errors.name ? 'border-red-500' : ''} />
              {errors.name && <span className="text-red-500 text-sm">{errors.name.message}</span>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Specialty</label>
              <Input {...register('specialty')} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contact Number *</label>
              <Input
                {...register('contactNo')}
                type="tel"
                className={errors.contactNo ? 'border-red-500' : ''}
              />
              {errors.contactNo && <span className="text-red-500 text-sm">{errors.contactNo.message}</span>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
              <Input {...register('availability')} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
            <select
              aria-label="Status"
              {...register('status')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              aria-label="Notes"
              {...register('notes')}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex flex-wrap gap-4 pt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/health/doctors')}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
