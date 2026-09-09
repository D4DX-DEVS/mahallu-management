import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { FiTrash2, FiPlus } from 'react-icons/fi';
import { createInheritanceCase } from '@/services/counsellingService';
import { memberService } from '@/services/memberService';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

interface FormData {
  deceasedName?: string;
  deceasedMemberId?: string;
  deathRegistrationId?: string;
  heirs: Array<{ name: string; relation: string; contactNo?: string }>;
}

export default function InheritanceCreate() {
  const navigate = useNavigate();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    defaultValues: {
      heirs: [{ name: '', relation: '', contactNo: '' }],
    },
  });
  const {
    fields: heirsFields,
    append: appendHeir,
    remove: removeHeir,
  } = useFieldArray({
    control,
    name: 'heirs',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  useEffect(() => {
    memberService
      .getAll({ page: 1, limit: 200 } as any)
      .then((result: any) => setMembers(result.data || []))
      .catch(() => setMembers([]))
      .finally(() => setLoadingMembers(false));
  }, []);

  const onSubmit = async (formData: FormData) => {
    if (!formData.deceasedName && !formData.deceasedMemberId) {
      setError('Either provide deceased name or select a member');
      return;
    }

    const heirs = formData.heirs.filter((h) => h.name && h.relation);
    if (heirs.length === 0) {
      setError('At least one heir with name and relation is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await createInheritanceCase({
        deceasedName: formData.deceasedName || undefined,
        deceasedMemberId: formData.deceasedMemberId || undefined,
        deathRegistrationId: formData.deathRegistrationId || undefined,
        heirs,
        status: 'reported',
      });
      navigate('/inheritance');
    } catch (err: any) {
      setError(errorMessage(err, { action: 'create case' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="max-w-2xl">
        <PageHeader title="Create Inheritance Case" />
        <Card padding="lg">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 text-sm p-3 rounded">{error}</div>
            )}

            {/* Deceased Information */}
            <div className="border-b pb-6">
              <h3 className="font-semibold mb-3">Deceased Information</h3>
              <div className="space-y-4">
                <div>
                  <Controller
                    name="deceasedMemberId"
                    control={control}
                    render={({ field }) => (
                      <SearchableSelect
                        label="Deceased Member (Optional)"
                        value={field.value}
                        onChange={field.onChange}
                        options={members.map((member: any) => ({
                          value: member._id || member.id,
                          label: `${member.name}${member.familyName ? ` - ${member.familyName}` : ''}`,
                        }))}
                        placeholder="Search members..."
                        isLoading={loadingMembers}
                        helperText="Select if this person has a member record, or provide name below"
                      />
                    )}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Deceased Name *</label>
                  <input
                    aria-label="Deceased Name"
                    {...register('deceasedName', {
                      maxLength: { value: 100, message: 'Please keep the name to 100 characters or less.' },
                    })}
                    type="text"
                    placeholder="Provide if not selecting member"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-600 mt-1">Provide either member ID or name</p>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Death Registration ID (Optional)</label>
                  <input
                    aria-label="Death Registration ID (Optional)"
                    {...register('deathRegistrationId')}
                    type="text"
                    placeholder="If available"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Heirs */}
            <div className="border-b pb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Heirs *</h3>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => appendHeir({ name: '', relation: '', contactNo: '' })}
                  className="flex items-center gap-2"
                >
                  <FiPlus size={16} />
                  Add Heir
                </Button>
              </div>
              <div className="space-y-4">
                {heirsFields.map((field, idx) => (
                  <Card key={field.id} className="bg-gray-50">
                    <div className="space-y-3">
                      <div>
                        <label className="block text-label font-medium mb-1">Heir Name *</label>
                        <input
                          aria-label="Heir Name"
                          {...register(`heirs.${idx}.name`, {
                            required: 'Please enter the heir’s name.',
                            maxLength: { value: 100, message: 'Please keep the name to 100 characters or less.' },
                          })}
                          type="text"
                          placeholder="Full name"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        {errors.heirs?.[idx]?.name && (
                          <p className="text-red-600 text-label mt-1">{errors.heirs[idx]?.name?.message}</p>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div>
                          <label className="block text-label font-medium mb-1">Relation *</label>
                          <input
                            aria-label="Relation"
                            {...register(`heirs.${idx}.relation`, {
                              required: 'Please enter the relationship.',
                              maxLength: { value: 100, message: 'Please keep the relationship to 100 characters or less.' },
                            })}
                            type="text"
                            placeholder="e.g., Son, Daughter, Wife"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                          {errors.heirs?.[idx]?.relation && (
                            <p className="text-red-600 text-label mt-1">
                              {errors.heirs[idx]?.relation?.message}
                            </p>
                          )}
                        </div>
                        <div>
                          <label className="block text-label font-medium mb-1">Contact No</label>
                          <input
                            aria-label="Contact No"
                            {...register(`heirs.${idx}.contactNo`, {
                              pattern: {
                                value: /^[0-9]{10}$/,
                                message: 'Please enter a 10-digit phone number.',
                              },
                            })}
                            type="text"
                            placeholder="Optional"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                          />
                        </div>
                      </div>

                      {heirsFields.length > 1 && (
                        <Button
                          type="button"
                          variant="danger"
                          size="sm"
                          onClick={() => removeHeir(idx)}
                          className="flex items-center gap-2 w-full justify-center"
                        >
                          <FiTrash2 size={16} />
                          Remove Heir
                        </Button>
                      )}
                    </div>
                  </Card>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => navigate('/inheritance')}
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
