import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/constants/routes';
import { religiousService, KHUTBAH_STATUS_OPTIONS } from '@/services/religiousService';
import { Khateeb } from '@/services/religiousService';

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
        typeof data.khateebId === 'object' ? data.khateebId._id : data.khateebId
      );
      setValue('date', String(data.date).split('T')[0]);
      setValue('topic', data.topic);
      setValue('topicMl', data.topicMl || '');
      setValue('notes', data.notes || '');
      setValue('resourceUrl', data.resourceUrl || '');
      setValue('status', data.status || 'scheduled');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load khutbah');
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
      setError(err.response?.data?.message || 'Failed to update khutbah');
    }
  };

  if (loading) return <PageSkeleton />;

  const khateebOptions = khateebs.map((k) => ({
    value: k._id,
    label: k.name,
  }));

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: ROUTES.DASHBOARD },
          { label: 'Khutbah Schedule', path: ROUTES.RELIGIOUS.KHUTBAHS },
          { label: 'Edit Khutbah' },
        ]}
      />

      <Card>
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Edit Khutbah</h1>
          <Button
            variant="outline"
            onClick={() => navigate(ROUTES.RELIGIOUS.KHUTBAHS)}
          >
            <FiX className="inline mr-2" />
            Cancel
          </Button>
        </div>

        {error && <div className="p-4 bg-red-100 text-red-800 rounded mb-6">{error}</div>}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <Input
                label="Date *"
                type="date"
                {...register('date')}
                error={errors.date?.message}
              />
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
                placeholder="Link to khutbah notes or recording"
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

          <div className="flex justify-end gap-4 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(ROUTES.RELIGIOUS.KHUTBAHS)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              disabled={isSubmitting}
            >
              <FiSave className="inline mr-2" />
              Save Changes
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
