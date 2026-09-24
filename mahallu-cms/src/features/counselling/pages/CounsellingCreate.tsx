import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { createCounsellingCase } from '@/services/counsellingService';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const CATEGORIES = ['marriage', 'family', 'adolescent', 'education', 'parenting', 'behaviour', 'career'];

interface FormData {
  category: string;
  counsellorName: string;
  appointmentDate: string;
  clientMemberId?: string;
  clientName?: string;
}

export default function CounsellingCreate() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormData>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isAnonymous = watch('clientName');

  const onSubmit = async (formData: FormData) => {
    if (!formData.clientMemberId && !formData.clientName) {
      setError('Please choose a member, or enter a name for an anonymous client.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      // Cast form data to service type (form values are strings, service expects exact types)
      await createCounsellingCase(formData as any);
      navigate('/counselling');
    } catch (err: any) {
      setError(errorMessage(err, { action: 'create case' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="max-w-2xl">
        <PageHeader title="Create Counselling Case" />
        <Card padding="lg">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-3 rounded">{error}</div>
            )}

            {/* Category */}
            <div>
              <label className="block text-sm font-medium mb-2">Category *</label>
              <select
                aria-label="Category"
                {...register('category', { required: 'Please choose the category.' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select category...</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
              {errors.category && <p className="text-red-600 text-sm mt-1">{errors.category.message}</p>}
            </div>

            {/* Counsellor Name */}
            <div>
              <label className="block text-sm font-medium mb-2">Counsellor Name *</label>
              <input
                aria-label="Counsellor Name"
                {...register('counsellorName', {
                  required: 'Please enter the counsellor’s name.',
                  minLength: { value: 2, message: 'Please keep the name between 2 and 100 characters.' },
                  maxLength: { value: 100, message: 'Please keep the name between 2 and 100 characters.' },
                })}
                type="text"
                placeholder="Enter counsellor name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
              {errors.counsellorName && (
                <p className="text-red-600 text-sm mt-1">{errors.counsellorName.message}</p>
              )}
            </div>

            {/* Appointment Date */}
            <div>
              <label className="block text-sm font-medium mb-2">Appointment Date *</label>
              <input
                aria-label="Appointment Date"
                {...register('appointmentDate', {
                  required: 'Please choose the appointment date.',
                  validate: (value) =>
                    !value ||
                    (!Number.isNaN(new Date(value).getTime()) && new Date(value) > new Date('1900-01-01')) ||
                    'Please choose a valid appointment date.',
                })}
                type="datetime-local"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
              {errors.appointmentDate && (
                <p className="text-red-600 text-sm mt-1">{errors.appointmentDate.message}</p>
              )}
            </div>

            {/* Client Selection */}
            <div className="border-t pt-6">
              <h3 className="font-semibold mb-3">Client Information</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Member ID (Optional)</label>
                  <input
                    aria-label="Member ID (Optional)"
                    {...register('clientMemberId')}
                    type="text"
                    placeholder="Select member or provide name for anonymous"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Client Name (for anonymous clients)
                  </label>
                  <input
                    aria-label="Client Name (for anonymous clients)"
                    {...register('clientName', {
                      maxLength: { value: 100, message: 'Please keep the name to 100 characters or less.' },
                    })}
                    type="text"
                    placeholder="Leave empty if selecting member"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <p className="text-xs text-gray-600">
                  Provide either a member ID or a name (for anonymous clients)
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-6 border-t">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/counselling')}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={loading}>
                {loading ? 'Creating...' : 'Create Case'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
