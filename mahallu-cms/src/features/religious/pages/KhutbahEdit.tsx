import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { FiSave } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { ROUTES } from '@/constants/routes';
import { religiousService, KHUTBAH_STATUS_OPTIONS } from '@/services/religiousService';
import { Khateeb } from '@/services/religiousService';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const khutbahSchema = z.object({
  khateebId: z.string().min(1, 'Khateeb is required'),
  date: z.string().min(1, 'Date is required'),
  topic: z.string().min(1, 'Topic is required'),
  topicMl: z.string().optional(),
  notes: z.string().optional(),
  resourceUrl: z.string().optional(),
  status: z.enum(['scheduled', 'delivered', 'cancelled']).optional(),
});

type KhutbahFormData = z.infer<typeof khutbahSchema>;

export default function KhutbahEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [khateebs, setKhateebs] = useState<Khateeb[]>([]);
  const [loadingKhateebs, setLoadingKhateebs] = useState(true);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<KhutbahFormData>({
    resolver: zodResolver(khutbahSchema),
    defaultValues: {
      status: 'scheduled',
    },
  });

  useEffect(() => {
    fetchKhateebs();
    if (id) {
      fetchKhutbah();
    }
  }, [id]);

  const fetchKhutbah = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await religiousService.getKhutbahById(id);
      setValue(
        'khateebId',
        typeof data.khateebId === 'object' ? data.khateebId.id : data.khateebId
      );
      setValue('date', String(data.date).split('T')[0]);
      setValue('topic', data.topic);
      setValue('topicMl', data.topicMl || '');
      setValue('notes', data.notes || '');
      setValue('resourceUrl', data.resourceUrl || '');
      setValue('status', data.status || 'scheduled');
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load khutbah. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  const fetchKhateebs = async () => {
    try {
      setLoadingKhateebs(true);
      const result = await religiousService.getAllKhateebs({ limit: 100 });
      setKhateebs(result.data || []);
    } catch (err) {
      console.error('Error fetching khateebs:', err);
      setKhateebs([]);
    } finally {
      setLoadingKhateebs(false);
    }
  };

  const onSubmit = async (data: KhutbahFormData) => {
    if (!id) return;
    try {
      setError(null);
      await religiousService.updateKhutbah(id, data);
      navigate(ROUTES.RELIGIOUS.KHUTBAHS);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't update khutbah. Try again in a moment."));
    }
  };

  if (loading) return <LoadingSpinner />;

  const khateebOptions = khateebs.map((k) => ({
    value: k.id,
    label: k.name,
  }));

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Edit khutbah" description="Update the khutbah details" />

      {error && <Alert tone="danger">{error}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Khutbah details</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Khateeb, date and topic</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Select
              label="Khateeb *"
              {...register('khateebId')}
              value={watch('khateebId') || ''}
              options={khateebOptions}
              error={errors.khateebId?.message}
              disabled={loadingKhateebs}
            />

            <Input
              label="Date *"
              type="date"
              {...register('date')}
              error={errors.date?.message}
            />

            <div className="md:col-span-2">
              <Input
                label="Topic *"
                {...register('topic')}
                error={errors.topic?.message}
                placeholder="Enter khutbah topic"
              />
            </div>

            <div className="md:col-span-2">
              <Input
                label="Topic (Malayalam)"
                {...register('topicMl')}
                placeholder="Enter khutbah topic in Malayalam"
              />
            </div>
          </div>
        </Card>

        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Preparation</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Notes, resources and status</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label htmlFor="khutbah-notes" className={labelClasses}>Notes</label>
              <textarea
                id="khutbah-notes"
                {...register('notes')}
                placeholder="Enter any notes or preparation details"
                className={`${controlClasses} resize-none py-2`}
                rows={3}
              />
            </div>

            <div className="md:col-span-2">
              <Input
                label="Resource URL"
                type="url"
                {...register('resourceUrl')}
                placeholder="Link to khutbah notes or recording"
              />
            </div>

            <Select
              label="Status"
              {...register('status')}
              value={watch('status') || ''}
              options={KHUTBAH_STATUS_OPTIONS}
              error={errors.status?.message}
            />
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(ROUTES.RELIGIOUS.KHUTBAHS)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
            <FiSave className="h-3.5 w-3.5" />
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
