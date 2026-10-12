import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { ROUTES } from '@/constants/routes';
import { assetService } from '@/services/assetService';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const assetSchema = z.object({
  name: z.string().min(1, 'Asset name is required').max(200),
  nameMl: z.string().optional(),
  description: z.string().optional(),
  purchaseDate: z.string().min(1, 'Purchase date is required'),
  estimatedValue: z.string().min(1, 'Estimated value is required'),
  category: z.enum(['furniture', 'electronics', 'vehicle', 'building', 'land', 'equipment', 'other'], {
    required_error: 'Category is required',
  }),
  status: z.enum(['active', 'in_use', 'under_maintenance', 'disposed', 'damaged']).optional(),
  location: z.string().optional(),
  locationMl: z.string().optional(),
});

type AssetFormData = z.infer<typeof assetSchema>;

export default function EditAsset() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<AssetFormData>({
    resolver: zodResolver(assetSchema),
  });

  useEffect(() => {
    if (id) {
      fetchAsset();
    }
  }, [id]);

  const fetchAsset = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const asset = await assetService.getById(id);
      setValue('name', asset.name);
      setValue('description', asset.description || '');
      setValue('purchaseDate', asset.purchaseDate ? new Date(asset.purchaseDate).toISOString().split('T')[0] : '');
      setValue('estimatedValue', String(asset.estimatedValue || 0));
      setValue('category', asset.category);
      setValue('status', asset.status || 'active');
      setValue('location', asset.location || '');
      setValue('nameMl', asset.nameMl || '');
      setValue('locationMl', asset.locationMl || '');
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load asset. Refresh the page or try again."));
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
      };

      await assetService.update(id, assetData);
      navigate(ROUTES.ASSETS.LIST);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't update asset. Try again in a moment."));
      console.error('Error updating asset:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Edit Asset"
        description="Update asset information"
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-6">
          <div>
            <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">Asset details</h2>
            <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Name, category, value and location</p>
          </div>
          {error && (
            <Alert tone="danger">{error}</Alert>
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
              <label className={labelClasses}>Description</label>
              <textarea
                {...register('description')}
                rows={3}
                className={`${controlClasses} py-2`}
                placeholder="Brief description about the asset..."
              />
            </div>
          </div>

          <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none rounded-b-card border-t border-line bg-white/90 px-4 py-3 backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button type="button" variant="secondary" onClick={() => navigate(ROUTES.ASSETS.LIST)}>
              <FiX className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <FiSave className="h-3.5 w-3.5" />
              {isSubmitting ? 'Updating...' : 'Update Asset'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
