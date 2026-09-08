import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { FiSave, FiUpload, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/constants/routes';
import { socialService } from '@/services/socialService';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const bannerSchema = z.object({
  title: z
    .string()
    .min(2, 'Title must be at least 2 characters')
    .max(200, 'Title must be at most 200 characters'),
  image: z.string().max(200, 'Please keep the image to 200 characters or less.').optional(),
  link: z.string().max(200, 'Please keep the link to 200 characters or less.').optional(),
  status: z.enum(['active', 'inactive']).optional(),
  startDate: z.string().max(200, 'Please keep the start date to 200 characters or less.').optional(),
  endDate: z.string().max(200, 'Please keep the end date to 200 characters or less.').optional(),
});

type BannerFormData = z.infer<typeof bannerSchema>;

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

function toInputDate(value?: string): string {
  if (!value) return '';
  return new Date(value).toISOString().split('T')[0];
}

export default function EditBanner() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [objectPreviewUrl, setObjectPreviewUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BannerFormData>({
    resolver: zodResolver(bannerSchema),
    defaultValues: {
      status: 'active',
    },
  });

  const imageUrl = watch('image');

  useEffect(() => {
    if (!id) {
      setError('Banner ID is missing.');
      setLoading(false);
      return;
    }

    const fetchBanner = async () => {
      try {
        setLoading(true);
        setError(null);
        const banner = await socialService.getBannerById(id);

        setValue('title', banner.title || '');
        setValue('image', banner.image || '');
        setValue('link', banner.link || '');
        setValue('status', banner.status || 'active');
        setValue('startDate', toInputDate(banner.startDate));
        setValue('endDate', toInputDate(banner.endDate));

        if (banner.image) {
          setImagePreview(banner.image);
        }
      } catch (err: any) {
        setError(loadErrorMessage(err, 'banner details'));
      } finally {
        setLoading(false);
      }
    };

    fetchBanner();
  }, [id, setValue]);

  useEffect(() => {
    return () => {
      if (objectPreviewUrl) {
        URL.revokeObjectURL(objectPreviewUrl);
      }
    };
  }, [objectPreviewUrl]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      if (objectPreviewUrl) {
        URL.revokeObjectURL(objectPreviewUrl);
        setObjectPreviewUrl(null);
      }
      setImageFile(null);
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Only JPEG, PNG, WebP, and GIF images are allowed.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (objectPreviewUrl) {
        URL.revokeObjectURL(objectPreviewUrl);
        setObjectPreviewUrl(null);
      }
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('Image size must be 5 MB or smaller.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      if (objectPreviewUrl) {
        URL.revokeObjectURL(objectPreviewUrl);
        setObjectPreviewUrl(null);
      }
      return;
    }

    setError(null);

    if (objectPreviewUrl) {
      URL.revokeObjectURL(objectPreviewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setObjectPreviewUrl(objectUrl);
    setImageFile(file);
    setImagePreview(objectUrl);
    setValue('image', '', { shouldValidate: true });
  };

  const removeSelectedImage = () => {
    if (objectPreviewUrl) {
      URL.revokeObjectURL(objectPreviewUrl);
      setObjectPreviewUrl(null);
    }
    setImageFile(null);
    setImagePreview(null);
    setValue('image', '', { shouldValidate: true });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const onSubmit = async (data: BannerFormData) => {
    if (!id) return;

    try {
      setError(null);

      const manualImageUrl = data.image?.trim();
      if (!manualImageUrl && !imageFile) {
        setError('Please provide an image URL or upload an image file.');
        return;
      }

      let bannerImage = manualImageUrl;
      if (imageFile) {
        setIsUploadingImage(true);
        bannerImage = await socialService.uploadBannerImage(imageFile);
      }

      if (!bannerImage) {
        setError("Couldn't determine banner image. Please try again.");
        return;
      }

      const bannerData: any = {
        title: data.title,
        image: bannerImage,
        link: data.link?.trim() || undefined,
        startDate: data.startDate || undefined,
        endDate: data.endDate || undefined,
        status: data.status || 'active',
      };

      await socialService.updateBanner(id, bannerData);
      navigate(ROUTES.SOCIAL.BANNERS);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'update banner. please try again' }));
    } finally {
      setIsUploadingImage(false);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit Banner"
        description="Update banner details"
        breadcrumbs={[{ label: 'Banners', path: ROUTES.SOCIAL.BANNERS }]}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Title"
              {...register('title')}
              error={errors.title?.message}
              required
              placeholder="Banner Title"
              className="md:col-span-2"
            />
            <Input
              label="Image URL"
              {...register('image')}
              error={errors.image?.message}
              placeholder="https://example.com/banner.jpg (optional if file is uploaded)"
              className="md:col-span-2"
            />

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Upload From PC <span className="text-gray-400 text-xs font-normal">(optional)</span>
              </label>

              {imagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Selected banner preview"
                    className="h-40 w-auto max-w-full rounded-lg object-cover border border-gray-200 dark:border-gray-700"
                  />
                  <button
                    type="button"
                    onClick={removeSelectedImage}
                    className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                    aria-label="Remove selected image"
                  >
                    <FiX className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 transition-colors bg-gray-50 dark:bg-gray-800/50">
                  <FiUpload className="h-8 w-8 text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Click to choose image from your computer
                  </span>
                  <span className="text-xs text-gray-400 mt-1">JPEG, PNG, WebP or GIF · max 5 MB</span>
                  <input
                    aria-label="Choose a file"
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleImageChange}
                    className="sr-only"
                  />
                </label>
              )}

              {imageUrl && !imageFile && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Using image URL from the field above.
                </p>
              )}
            </div>

            <Input
              label="Link"
              {...register('link')}
              placeholder="https://example.com (Optional)"
              className="md:col-span-2"
            />
            <Input label="Start Date" type="date" {...register('startDate')} />
            <Input label="End Date" type="date" {...register('endDate')} />
            <Select
              label="Status"
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              {...register('status')}
              className="md:col-span-2"
            />
          </div>

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.SOCIAL.BANNERS)}>
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting || isUploadingImage}>
              <FiSave className="h-4 w-4 mr-2" />
              {isUploadingImage ? 'Uploading Image...' : 'Update Banner'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
