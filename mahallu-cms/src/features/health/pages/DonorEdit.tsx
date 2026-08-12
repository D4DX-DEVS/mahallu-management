import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiArrowLeft } from 'react-icons/fi';
import { getHealthResourceById, updateHealthResource } from '@/services/healthService';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

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
        setError('Failed to load blood donor');
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
      setError(err.response?.data?.message || 'Failed to update blood donor');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 sm:p-6 max-w-2xl">
        <button
          onClick={() => navigate('/health/donors')}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-800 mb-6"
        >
          <FiArrowLeft /> Back to Blood Donors
        </button>

        <h1 className="text-2xl sm:text-3xl font-bold mb-6">Edit Blood Donor</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name *
              </label>
              <Input
                {...register('name')}
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <span className="text-red-500 text-sm">{errors.name.message}</span>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Blood Group *
              </label>
              <select
                {...register('bloodGroup')}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 ${
                  errors.bloodGroup ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">Select blood group</option>
                {bloodGroups.map((bg) => (
                  <option key={bg} value={bg}>
                    {bg}
                  </option>
                ))}
              </select>
              {errors.bloodGroup && (
                <span className="text-red-500 text-sm">{errors.bloodGroup.message}</span>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contact Number *
              </label>
              <Input
                {...register('contactNo')}
                type="tel"
                className={errors.contactNo ? 'border-red-500' : ''}
              />
              {errors.contactNo && (
                <span className="text-red-500 text-sm">{errors.contactNo.message}</span>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Availability
              </label>
              <Input {...register('availability')} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              {...register('status')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes
            </label>
            <textarea
              {...register('notes')}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-4 pt-6">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/health/donors')}
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
