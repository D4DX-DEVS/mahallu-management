import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import Input from '@/components/ui/Input';
import { FiTrash2, FiPlus } from 'react-icons/fi';
import { createInheritanceCase } from '@/services/counsellingService';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

interface FormData {
  deceasedName?: string;
  deceasedMemberId?: string;
  deathRegistrationId?: string;
  heirs: Array<{ name: string; relation: string; contactNo?: string }>;
}

export default function InheritanceCreate() {
  const navigate = useNavigate();
  const { register, control, handleSubmit, formState: { errors } } = useForm<FormData>({
    defaultValues: {
      heirs: [{ name: '', relation: '', contactNo: '' }],
    },
  });
  const { fields: heirsFields, append: appendHeir, remove: removeHeir } = useFieldArray({
    control,
    name: 'heirs',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (formData: FormData) => {
    if (!formData.deceasedName && !formData.deceasedMemberId) {
      setError('Either provide deceased name or select a member');
      return;
    }

    const heirs = formData.heirs.filter(h => h.name && h.relation);
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
      toast.error(getFriendlyError(err, "Couldn't create case. Check the details and try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Create inheritance case" description="Record the deceased and their heirs" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        {/* Deceased Information */}
        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Deceased information</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Provide either a member ID or a name</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Deceased Member ID (Optional)"
              type="text"
              placeholder="Select member or provide name below"
              {...register('deceasedMemberId')}
            />
            <Input
              label="Deceased Name *"
              type="text"
              placeholder="Provide if not selecting member"
              helperText="Provide either member ID or name"
              {...register('deceasedName')}
            />
            <Input
              label="Death Registration ID (Optional)"
              type="text"
              placeholder="If available"
              {...register('deathRegistrationId')}
            />
          </div>
        </Card>

        {/* Heirs */}
        <Card padding="lg">
          <div className="mb-3.5 flex items-center justify-between">
            <div>
              <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Heirs *</h2>
              <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">At least one heir with name and relation</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => appendHeir({ name: '', relation: '', contactNo: '' })}
            >
              <FiPlus size={14} />
              Add Heir
            </Button>
          </div>
          <div className="space-y-3">
            {heirsFields.map((field, idx) => (
              <div key={field.id} className="rounded-[12px] border border-line-soft bg-[#FAFCFB] p-3.5 dark:border-surface-border dark:bg-surface-base/40">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Input
                    label="Heir Name *"
                    type="text"
                    placeholder="Full name"
                    error={errors.heirs?.[idx]?.name?.message}
                    {...register(`heirs.${idx}.name`, { required: 'Name is required' })}
                  />
                  <Input
                    label="Relation *"
                    type="text"
                    placeholder="e.g., Son, Daughter, Wife"
                    error={errors.heirs?.[idx]?.relation?.message}
                    {...register(`heirs.${idx}.relation`, { required: 'Relation is required' })}
                  />
                  <Input
                    label="Contact No"
                    type="text"
                    placeholder="Optional"
                    {...register(`heirs.${idx}.contactNo`)}
                  />
                </div>

                {heirsFields.length > 1 && (
                  <Button type="button" variant="danger" size="sm" onClick={() => removeHeir(idx)} className="mt-3">
                    <FiTrash2 size={14} />
                    Remove Heir
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/inheritance')} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Case'}
          </Button>
        </div>
      </form>
    </div>
  );
}
