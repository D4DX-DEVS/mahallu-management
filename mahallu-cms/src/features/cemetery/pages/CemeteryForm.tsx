import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import cemeteryService, { Cemetery } from '../../../services/cemeteryService';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import Input from '../../../components/ui/Input';
import { FiArrowLeft } from 'react-icons/fi';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const cemeterySchema = z.object({
  name: z.string().max(200, 'Please keep the name to 200 characters or less.').min(1, 'Cemetery name is required'),
  location: z.string().max(300, 'Please keep the location to 300 characters or less.').optional(),
  capacity: z.number().min(1, 'Capacity must be at least 1'),
  notes: z.string().max(2000, 'Please keep the notes to 2000 characters or less.').optional(),
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
          setError(loadErrorMessage(err, 'cemetery'));
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
      setError(errorMessage(err, { action: 'save cemetery' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/cemetery')} className="flex items-center gap-2">
          <FiArrowLeft /> Back
        </Button>
        <PageHeader title={id ? 'Edit Cemetery' : 'Create Cemetery'} />
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      <Card padding="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cemetery Name *</label>
            <Input
              {...register('name')}
              placeholder="Enter cemetery name"
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Location</label>
            <Input {...register('location')} placeholder="Enter location" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Capacity *</label>
            <Input
              {...register('capacity', { valueAsNumber: true })}
              type="number"
              placeholder="Enter cemetery capacity"
              min="1"
              className={errors.capacity ? 'border-red-500' : ''}
            />
            {errors.capacity && <p className="mt-1 text-sm text-red-600">{errors.capacity.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              aria-label="Status"
              {...register('status')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              aria-label="Notes"
              {...register('notes')}
              placeholder="Enter any additional notes"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-wrap gap-3 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Saving...' : 'Save Cemetery'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/cemetery')} className="flex-1">
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
