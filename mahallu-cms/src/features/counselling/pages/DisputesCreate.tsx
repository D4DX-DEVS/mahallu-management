import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { FiTrash2, FiPlus } from 'react-icons/fi';
import { createDisputeCase } from '@/services/counsellingService';

const DISPUTE_TYPES = ['family', 'marriage', 'divorce', 'community', 'inheritance', 'other'];

interface FormData {
  type: string;
  description: string;
  parties: Array<{ value: string }>;
  mediators: Array<{ value: string }>;
}

export default function DisputesCreate() {
  const navigate = useNavigate();
  const { register, control, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      parties: [{ value: '' }],
      mediators: [{ value: '' }],
    },
  });
  const { fields: partiesFields, append: appendParty, remove: removeParty } = useFieldArray({
    control,
    name: 'parties',
  });
  const { fields: mediatorsFields, append: appendMediator, remove: removeMediator } = useFieldArray({
    control,
    name: 'mediators',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (formData: FormData) => {
    const parties = formData.parties.map(p => p.value).filter(p => p);
    const mediators = formData.mediators.map(m => m.value).filter(m => m);

    if (parties.length === 0) {
      setError('At least one party is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await createDisputeCase({
        type: formData.type as any,
        description: formData.description,
        parties,
        mediators,
        status: 'registered',
      });
      navigate('/maslahat');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create case');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 sm:p-6 max-w-2xl">
        <h1 className="text-2xl sm:text-3xl font-bold mb-6">Create Dispute Case</h1>

        <Card className="p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-3 rounded">
                {error}
              </div>
            )}

            {/* Type */}
            <div>
              <label className="block text-sm font-medium mb-2">Dispute Type *</label>
              <select
                {...register('type', { required: 'Type is required' })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">Select type...</option>
                {DISPUTE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
              {errors.type && <p className="text-red-600 text-sm mt-1">{errors.type.message}</p>}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-2">Description *</label>
              <textarea
                {...register('description', { required: 'Description is required' })}
                placeholder="Describe the dispute..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
              {errors.description && <p className="text-red-600 text-sm mt-1">{errors.description.message}</p>}
            </div>

            {/* Parties */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">Parties Involved *</h3>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => appendParty({ value: '' })}
                  className="flex items-center gap-2"
                >
                  <FiPlus size={16} />
                  Add
                </Button>
              </div>
              <div className="space-y-3">
                {partiesFields.map((field, idx) => (
                  <div key={field.id} className="flex gap-2">
                    <input
                      {...register(`parties.${idx}.value`)}
                      type="text"
                      placeholder={`Party ${idx + 1} name`}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                    />
                    {partiesFields.length > 1 && (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => removeParty(idx)}
                        className="flex items-center gap-2"
                      >
                        <FiTrash2 size={16} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Mediators */}
            <div className="border-t pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold">Mediators (Optional)</h3>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => appendMediator({ value: '' })}
                  className="flex items-center gap-2"
                >
                  <FiPlus size={16} />
                  Add
                </Button>
              </div>
              <div className="space-y-3">
                {mediatorsFields.map((field, idx) => (
                  <div key={field.id} className="flex gap-2">
                    <input
                      {...register(`mediators.${idx}.value`)}
                      type="text"
                      placeholder={`Mediator ${idx + 1} name`}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg"
                    />
                    {mediatorsFields.length > 0 && (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => removeMediator(idx)}
                        className="flex items-center gap-2"
                      >
                        <FiTrash2 size={16} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-6 border-t">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/maslahat')}
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
