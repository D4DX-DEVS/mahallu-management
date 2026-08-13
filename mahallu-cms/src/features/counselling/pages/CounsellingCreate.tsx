import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { createCounsellingCase } from '@/services/counsellingService';

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
  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const isAnonymous = watch('clientName');

  const onSubmit = async (formData: FormData) => {
    if (!formData.clientMemberId && !formData.clientName) {
      setError('Either select a member or provide a name for anonymous client');
      return;
    }

    try {
      setLoading(true);
      setError('');
      // Cast form data to service type (form values are strings, service expects exact types)
      await createCounsellingCase(formData as any);
      navigate('/counselling');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create case');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 sm:p-6 max-w-2xl">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6">Create Counselling Case</h1>

        <Card className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-3 rounded">
                {error}
              </div>
            )}

            {/* Category */}
            <div>
              <label className="block text-sm font-medium mb-2">Category *</label>
              <select
                {...register('category', { required: 'Category is required' })}
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
                {...register('counsellorName', { required: 'Counsellor name is required' })}
                type="text"
                placeholder="Enter counsellor name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
              {errors.counsellorName && <p className="text-red-600 text-sm mt-1">{errors.counsellorName.message}</p>}
            </div>

            {/* Appointment Date */}
            <div>
              <label className="block text-sm font-medium mb-2">Appointment Date *</label>
              <input
                {...register('appointmentDate', { required: 'Appointment date is required' })}
                type="datetime-local"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
              {errors.appointmentDate && <p className="text-red-600 text-sm mt-1">{errors.appointmentDate.message}</p>}
            </div>

            {/* Client Selection */}
            <div className="border-t pt-6">
              <h3 className="font-bold mb-4">Client Information</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Member ID (Optional)</label>
                  <input
                    {...register('clientMemberId')}
                    type="text"
                    placeholder="Select member or provide name for anonymous"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Client Name (for anonymous clients)</label>
                  <input
                    {...register('clientName')}
                    type="text"
                    placeholder="Leave empty if selecting member"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <p className="text-xs text-gray-600">Provide either a member ID or a name (for anonymous clients)</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-6 border-t">
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
