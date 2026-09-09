import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/constants/routes';
import { assetService } from '@/services/assetService';
import { mosqueService, MosqueProfile } from '@/services/mosqueService';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const assetSchema = z.object({
  name: z.string().min(1, 'Asset name is required').max(200),
  nameMl: z.string().max(200, 'Please keep the name to 200 characters or less.').optional(),
  description: z.string().max(3000, 'Please keep the description to 3000 characters or less.').optional(),
  purchaseDate: z.string().max(200, 'Please keep the purchase date to 200 characters or less.').min(1, 'Purchase date is required'),
  estimatedValue: z.string().max(200, 'Please keep the estimated value to 200 characters or less.').min(1, 'Estimated value is required'),
  category: z.enum(['furniture', 'electronics', 'vehicle', 'building', 'land', 'equipment', 'other'], {
    required_error: 'Category is required',
  }),
  status: z.enum(['active', 'in_use', 'under_maintenance', 'disposed', 'damaged']).optional(),
  location: z.string().max(300, 'Please keep the location to 300 characters or less.').optional(),
  locationMl: z.string().max(300, 'Please keep the location to 300 characters or less.').optional(),
  mosqueId: z.string().max(200, 'Please keep the mosque to 200 characters or less.').optional(),
});

type AssetFormData = z.infer<typeof assetSchema>;

export default function EditAsset() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [mosques, setMosques] = useState<MosqueProfile[]>([]);
  const [loadedMosqueId, setLoadedMosqueId] = useState<string>('');

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AssetFormData>({
    resolver: zodResolver(assetSchema),
  });

  useEffect(() => {
    mosqueService
      .getAll({ limit: 100 })
      .then((result) => setMosques(result.data))
      .catch(() => setMosques([]));
  }, []);

  useEffect(() => {
    if (id) {
      fetchAsset();
    }
  }, [id]);

  // Re-apply once mosques' <option>s exist in the DOM — setting it before they're
  // rendered races React's re-render and the <select aria-label="Filter"> silently keeps "Unassigned".
  useEffect(() => {
    if (loadedMosqueId && mosques.some((m) => m.id === loadedMosqueId)) {
      setValue('mosqueId', loadedMosqueId);
    }
  }, [mosques, loadedMosqueId]);

  const fetchAsset = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const asset = await assetService.getById(id);
      setValue('name', asset.name);
      setValue('description', asset.description || '');
      setValue(
        'purchaseDate',
        asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : ''
      );
      setValue('estimatedValue', String(asset.estimatedValue || 0));
      setValue('category', asset.category);
      setValue('status', asset.status || 'active');
      setValue('location', asset.location || '');
      setValue('nameMl', asset.nameMl || '');
      setValue('locationMl', asset.locationMl || '');
      setLoadedMosqueId(typeof asset.mosqueId === 'object' ? asset.mosqueId?.id || '' : asset.mosqueId || '');
    } catch (err: any) {
      setError(loadErrorMessage(err, 'asset'));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: AssetFormData) => {
    if (!id) return;
    try {
      setError(null);
      const assetData: any = {
        name: data.name,
        nameMl: data.nameMl,
        description: data.description || undefined,
        purchaseDate: data.purchaseDate,
        estimatedValue: parseFloat(data.estimatedValue),
        category: data.category,
        status: data.status || 'active',
        location: data.location || undefined,
        locationMl: data.locationMl,
        mosqueId: data.mosqueId || null,
      };

      await assetService.update(id, assetData);
      navigate(ROUTES.ASSETS.LIST);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'update asset. please try again' }));
      console.error('Error updating asset:', err);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Edit Asset"
        description="Update asset information"
        breadcrumbs={[{ label: 'Assets', path: ROUTES.ASSETS.LIST }]}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Asset Name"
              {...register('name')}
              error={errors.name?.message}
              required
              placeholder="e.g. Projector, Generator, Chairs"
              className="md:col-span-2"
            />
            <div className="hidden">
              <Input
                label="Asset Name (Malayalam)"
                {...register('nameMl')}
                placeholder="അസറ്റിന്റെ പേര്"
                className="md:col-span-2 font-malayalam"
              />
            </div>
            <Input
              label="Purchase Date"
              type="date"
              {...register('purchaseDate')}
              error={errors.purchaseDate?.message}
              required
            />
            <Input
              label="Estimated Value (₹)"
              type="number"
              step="0.01"
              min="0"
              {...register('estimatedValue')}
              error={errors.estimatedValue?.message}
              required
              placeholder="e.g. 50000"
            />
            <Select
              label="Category"
              options={[
                { value: '', label: 'Select Category' },
                { value: 'furniture', label: 'Furniture' },
                { value: 'electronics', label: 'Electronics' },
                { value: 'vehicle', label: 'Vehicle' },
                { value: 'building', label: 'Building' },
                { value: 'land', label: 'Land' },
                { value: 'equipment', label: 'Equipment' },
                { value: 'other', label: 'Other' },
              ]}
              {...register('category')}
              error={errors.category?.message}
              required
            />
            <Select
              label="Mosque"
              options={[
                { value: '', label: 'Unassigned' },
                ...mosques.map((m) => ({ value: m.id, label: m.name })),
              ]}
              {...register('mosqueId')}
            />
            <Select
              label="Status"
              options={[
                { value: 'active', label: 'Active' },
                { value: 'in_use', label: 'In Use' },
                { value: 'under_maintenance', label: 'Under Maintenance' },
                { value: 'disposed', label: 'Disposed' },
                { value: 'damaged', label: 'Damaged' },
              ]}
              {...register('status')}
            />
            <Input
              label="Location"
              {...register('location')}
              placeholder="e.g. Meeting Hall, Office Room"
              className="md:col-span-2"
            />
            <div className="hidden">
              <Input
                label="Location (Malayalam)"
                {...register('locationMl')}
                placeholder="സ്ഥലം"
                className="md:col-span-2 font-malayalam"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                aria-label="Description"
                {...register('description')}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Brief description about the asset..."
              />
            </div>
          </div>

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.ASSETS.LIST)}>
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <FiSave className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Updating...' : 'Update Asset'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
