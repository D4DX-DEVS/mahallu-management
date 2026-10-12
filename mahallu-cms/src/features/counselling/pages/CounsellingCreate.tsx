import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { createCounsellingCase } from '@/services/counsellingService';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

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
      toast.error(getFriendlyError(err, "Couldn't create case. Check the details and try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Create counselling case" description="Open a new confidential counselling case" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Case details</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Category, counsellor and appointment</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Select
                label="Category *"
                options={[
                  { value: '', label: 'Select category...' },
                  ...CATEGORIES.map((cat) => ({ value: cat, label: cat.charAt(0).toUpperCase() + cat.slice(1) })),
                ]}
                value={watch('category') || ''}
                error={errors.category?.message}
                {...register('category', { required: 'Category is required' })}
              />
            </div>

            <Input
              label="Counsellor Name *"
              type="text"
              placeholder="Enter counsellor name"
              error={errors.counsellorName?.message}
              {...register('counsellorName', { required: 'Counsellor name is required' })}
            />

            <Input
              label="Appointment Date *"
              type="datetime-local"
              error={errors.appointmentDate?.message}
              {...register('appointmentDate', { required: 'Appointment date is required' })}
            />
          </div>
        </Card>

        {/* Client Selection */}
        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Client information</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Provide either a member ID or a name (for anonymous clients)</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Member ID (Optional)"
              type="text"
              placeholder="Select member or provide name for anonymous"
              {...register('clientMemberId')}
            />
            <Input
              label="Client Name (for anonymous clients)"
              type="text"
              placeholder="Leave empty if selecting member"
              {...register('clientName')}
            />
          </div>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/counselling')} disabled={loading}>
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
