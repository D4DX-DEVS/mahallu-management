import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { ROUTES } from '@/constants/routes';
import { religiousService, KHUTBAH_STATUS_OPTIONS } from '@/services/religiousService';
import { Khateeb } from '@/services/religiousService';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

const khutbahSchema = z.object({
  khateebId: z.string().max(200, 'Please keep the khateeb to 200 characters or less.').min(1, 'Khateeb is required'),
  date: z.string().max(200, 'Please keep the date to 200 characters or less.').min(1, 'Date is required'),
  topic: z.string().max(200, 'Please keep the topic to 200 characters or less.').min(1, 'Topic is required'),
  topicMl: z.string().max(200, 'Please keep the topic to 200 characters or less.').optional(),
  notes: z.string().max(2000, 'Please keep the notes to 2000 characters or less.').optional(),
  resourceUrl: z.string().max(200, 'Please keep the resource url to 200 characters or less.').optional(),
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
    formState: { errors, isSubmitting },
  } = useForm<KhutbahFormData>({
    resolver: zodResolver(khutbahSchema),
    defaultValues: {
      status: 'scheduled',
      date: new Date(Math.ceil((Date.now() + 86400000) / 604800000) * 604800000 - 432000000)
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
      setError(errorMessage(err, { action: 'create khutbah' }));
    }
  };

  const khateebOptions = khateebs.map((k) => ({
    value: k.id,
    label: toTitleCase(k.name),
  }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="New Khutbah"
        breadcrumbs={[{ label: 'Khutbah Schedule', path: ROUTES.RELIGIOUS.KHUTBAHS }]}
      />

      <Card>
        <div className="flex justify-between items-center mb-4">
          <Button variant="outline" onClick={() => navigate(ROUTES.RELIGIOUS.KHUTBAHS)}>
            <FiX className="inline mr-2" />
            Cancel
          </Button>
        </div>

        {error && <div className="p-4 bg-red-100 text-red-800 rounded mb-4">{error}</div>}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Select
                label="Khateeb *"
                {...register('khateebId')}
                options={khateebOptions}
                error={errors.khateebId?.message}
                disabled={loadingKhateebs}
              />
            </div>

            <div>
              <Input label="Date *" type="date" {...register('date')} error={errors.date?.message} />
            </div>

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

            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-2">Notes</label>
              <textarea
                aria-label="Notes"
                {...register('notes')}
                placeholder="Enter any notes or preparation details"
                className="w-full px-3 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
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

            <div>
              <Select
                label="Status"
                {...register('status')}
                options={KHUTBAH_STATUS_OPTIONS}
                error={errors.status?.message}
              />
            </div>
          </div>

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-4 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(ROUTES.RELIGIOUS.KHUTBAHS)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
              <FiSave className="inline mr-2" />
              Create Khutbah
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
