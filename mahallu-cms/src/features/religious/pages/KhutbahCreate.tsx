import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiSave } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import Select from '@/components/ui/Select';
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

export default function KhutbahCreate() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [khateebs, setKhateebs] = useState<Khateeb[]>([]);
  const [loadingKhateebs, setLoadingKhateebs] = useState(true);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<KhutbahFormData>({
    resolver: zodResolver(khutbahSchema),
    defaultValues: {
      status: 'scheduled',
      date: new Date(
        Math.ceil((Date.now() + 86400000) / 604800000) * 604800000 - 432000000
      )
        .toISOString()
        .split('T')[0],
    },
  });

  useEffect(() => {
    fetchKhateebs();
  }, []);

  const fetchKhateebs = async () => {
    try {
      setLoadingKhateebs(true);
      const result = await religiousService.getAllKhateebs({ limit: 100, status: 'active' });
      setKhateebs(result.data || []);
    } catch (err) {
      console.error('Error fetching khateebs:', err);
      setKhateebs([]);
    } finally {
      setLoadingKhateebs(false);
    }
  };

  const onSubmit = async (data: KhutbahFormData) => {
    try {
      setError(null);
      await religiousService.createKhutbah(data);
      navigate(ROUTES.RELIGIOUS.KHUTBAHS);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create khutbah. Check the details and try again."));
    }
  };

  const khateebOptions = khateebs.map((k) => ({
    value: k.id,
    label: k.name,
  }));

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="New khutbah" description="Schedule a Friday khutbah" />

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
                placeholder="Link to khutbah notes or recording (if available)"
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
            Create Khutbah
          </Button>
        </div>
      </form>
    </div>
  );
}
