import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import cemeteryService, { Cemetery } from '../../../services/cemeteryService';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import Input, { controlClasses, labelClasses } from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import PageHeader from '../../../components/ui/PageHeader';
import Alert from '../../../components/ui/Alert';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const cemeterySchema = z.object({
  name: z.string().min(1, 'Cemetery name is required'),
  location: z.string().optional(),
  capacity: z.number().min(1, 'Capacity must be at least 1'),
  notes: z.string().optional(),
  status: z.enum(['active', 'inactive']),
});

type CemeteryFormData = z.infer<typeof cemeterySchema>;

export function CemeteryForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cemetery, setCemetery] = useState<Cemetery | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<CemeteryFormData>({
    resolver: zodResolver(cemeterySchema),
    defaultValues: {
      status: 'active',
    },
  });

  // Load cemetery if editing
  useEffect(() => {
    if (id) {
      const loadCemetery = async () => {
        try {
          const data = await cemeteryService.getCemeteryById(id);
          setCemetery(data);
          reset({
            name: data.name,
            location: data.location,
            capacity: data.capacity,
            notes: data.notes,
            status: data.status,
          });
        } catch (err: any) {
          setError(getFriendlyError(err, "Couldn't load cemetery. Refresh the page or try again."));
        }
      };
      loadCemetery();
    }
  }, [id, reset]);

  const onSubmit = async (data: CemeteryFormData) => {
    try {
      setLoading(true);
      setError(null);

      if (id) {
        await cemeteryService.updateCemetery(id, data);
      } else {
        await cemeteryService.createCemetery({
          tenantId: '',
          ...data,
        } as Cemetery);
      }

      navigate('/cemetery');
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't save cemetery. Check the details and try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title={id ? 'Edit cemetery' : 'Create cemetery'}
        description="Cemetery capacity and status"
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Cemetery details</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Name, location, capacity and status</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Cemetery Name *"
              {...register('name')}
              placeholder="Enter cemetery name"
              error={errors.name?.message}
            />

            <Input
              label="Location"
              {...register('location')}
              placeholder="Enter location"
            />

            <Input
              label="Capacity *"
              {...register('capacity', { valueAsNumber: true })}
              type="number"
              placeholder="Enter cemetery capacity"
              min="1"
              error={errors.capacity?.message}
            />

            <Select
              label="Status"
              {...register('status')}
              value={watch('status') || ''}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />

            <div className="md:col-span-2">
              <label htmlFor="cemetery-notes" className={labelClasses}>Notes</label>
              <textarea
                id="cemetery-notes"
                {...register('notes')}
                placeholder="Enter any additional notes"
                rows={4}
                className={`${controlClasses} py-2`}
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/cemetery')}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Cemetery'}
          </Button>
        </div>
      </form>
    </div>
  );
}
