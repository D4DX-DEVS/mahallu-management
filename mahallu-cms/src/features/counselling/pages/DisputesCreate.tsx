import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { FiTrash2, FiPlus } from 'react-icons/fi';
import { createDisputeCase } from '@/services/counsellingService';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const DISPUTE_TYPES = ['family', 'marriage', 'divorce', 'community', 'inheritance', 'other'];

interface FormData {
  type: string;
  description: string;
  parties: Array<{ value: string }>;
  mediators: Array<{ value: string }>;
}

export default function DisputesCreate() {
  const navigate = useNavigate();
  const { register, control, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
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
      toast.error(getFriendlyError(err, "Couldn't create case. Check the details and try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Create dispute case" description="Register a new Maslahat dispute" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Dispute details</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Type and a short description</p>
          <div className="space-y-4">
            <Select
              label="Dispute Type *"
              options={[
                { value: '', label: 'Select type...' },
                ...DISPUTE_TYPES.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) })),
              ]}
              value={watch('type') || ''}
              error={errors.type?.message}
              {...register('type', { required: 'Type is required' })}
            />

            <div>
              <label htmlFor="dispute-description" className={labelClasses}>
                Description<span className="ml-0.5 text-[#D9534F]">*</span>
              </label>
              <textarea
                id="dispute-description"
                {...register('description', { required: 'Description is required' })}
                placeholder="Describe the dispute..."
                rows={4}
                className={`${controlClasses} py-2`}
              />
              {errors.description && (
                <p role="alert" className="mt-1.5 text-[12px] font-medium text-[#B3261E] dark:text-red-300">{errors.description.message}</p>
              )}
            </div>
          </div>
        </Card>

        {/* Parties */}
        <Card padding="lg">
          <div className="mb-3.5 flex items-center justify-between">
            <div>
              <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Parties involved *</h2>
              <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">At least one party is required</p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => appendParty({ value: '' })}>
              <FiPlus size={14} />
              Add
            </Button>
          </div>
          <div className="space-y-3">
            {partiesFields.map((field, idx) => (
              <div key={field.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder={`Party ${idx + 1} name`}
                    aria-label={`Party ${idx + 1} name`}
                    {...register(`parties.${idx}.value`)}
                  />
                </div>
                {partiesFields.length > 1 && (
                  <Button type="button" variant="danger" iconOnly aria-label={`Remove party ${idx + 1}`} onClick={() => removeParty(idx)}>
                    <FiTrash2 size={14} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Mediators */}
        <Card padding="lg">
          <div className="mb-3.5 flex items-center justify-between">
            <div>
              <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Mediators (optional)</h2>
              <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">People mediating the dispute</p>
            </div>
            <Button type="button" variant="secondary" size="sm" onClick={() => appendMediator({ value: '' })}>
              <FiPlus size={14} />
              Add
            </Button>
          </div>
          <div className="space-y-3">
            {mediatorsFields.map((field, idx) => (
              <div key={field.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <Input
                    type="text"
                    placeholder={`Mediator ${idx + 1} name`}
                    aria-label={`Mediator ${idx + 1} name`}
                    {...register(`mediators.${idx}.value`)}
                  />
                </div>
                {mediatorsFields.length > 0 && (
                  <Button type="button" variant="danger" iconOnly aria-label={`Remove mediator ${idx + 1}`} onClick={() => removeMediator(idx)}>
                    <FiTrash2 size={14} />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/maslahat')} disabled={loading}>
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
