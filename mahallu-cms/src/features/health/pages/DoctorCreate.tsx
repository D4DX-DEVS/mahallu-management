import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiArrowLeft } from 'react-icons/fi';
import { createHealthResource } from '@/services/healthService';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const doctorSchema = z.object({
  name: z.string().max(200, 'Please keep the name to 200 characters or less.').min(1, 'Name is required'),
  specialty: z.string().max(200, 'Please keep the specialty to 200 characters or less.').optional(),
  contactNo: z.string().max(200, 'Please keep the contact no to 200 characters or less.').min(1, 'Contact number is required'),
  availability: z.string().max(200, 'Please keep the availability to 200 characters or less.').optional(),
  notes: z.string().max(2000, 'Please keep the notes to 2000 characters or less.').optional(),
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
      setError(errorMessage(err, { action: 'create doctor' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="max-w-2xl">
        <button
          onClick={() => navigate('/health/doctors')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
        >
          <FiArrowLeft /> Back to Doctors
        </button>

        <PageHeader title="Add New Doctor" />
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
              <Input
                {...register('name')}
                placeholder="Doctor's full name"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <span className="text-red-500 text-sm">{errors.name.message}</span>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Specialty</label>
              <Input {...register('specialty')} placeholder="e.g., Cardiology, Orthopedics" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contact Number *</label>
              <Input
                {...register('contactNo')}
                placeholder="Phone number"
                type="tel"
                className={errors.contactNo ? 'border-red-500' : ''}
              />
              {errors.contactNo && <span className="text-red-500 text-sm">{errors.contactNo.message}</span>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
              <Input {...register('availability')} placeholder="e.g., Weekdays 9AM-5PM" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
            <textarea
              aria-label="Notes"
              {...register('notes')}
              placeholder="Additional information..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-wrap gap-4 pt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/health/doctors')}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Doctor'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
