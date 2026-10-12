import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiUpload, FiX } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { ROUTES } from '@/constants/routes';
import { socialService } from '@/services/socialService';
import { getFriendlyError } from '@/utils/apiMessages';
import { toast } from '@/store/toastStore';

const bannerSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters').max(200, 'Title must be at most 200 characters'),
  image: z.string().optional(),
  link: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

type BannerFormData = z.infer<typeof bannerSchema>;

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function CreateBanner() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
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
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      setImageFile(null);
      setImagePreview(null);
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Only JPEG, PNG, WebP, and GIF images are allowed.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError('Image size must be 5 MB or smaller.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setError(null);

    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }

    setImageFile(file);
    setValue('image', '', { shouldValidate: true });
    setImagePreview(URL.createObjectURL(file));
  };

  const removeSelectedImage = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const onSubmit = async (data: BannerFormData) => {
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
        setError("Couldn't read the banner image. Choose the image again.");
        return;
      }

      const bannerData: any = {
        title: data.title,
        image: bannerImage,
        status: data.status || 'active',
      };

      if (data.link) bannerData.link = data.link;
      if (data.startDate) bannerData.startDate = data.startDate;
      if (data.endDate) bannerData.endDate = data.endDate;

      await socialService.createBanner(bannerData);
      navigate(ROUTES.SOCIAL.BANNERS);
    } catch (err: unknown) {
      toast.error(getFriendlyError(err, "Couldn't create the banner. Check the details and try again."));
    } finally {
      setIsUploadingImage(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Create banner" description="Add a new banner" />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card padding="lg" className="space-y-4">
          <div>
            <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Banner details</h2>
            <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Title, image, link and schedule</p>
          </div>

          {error && <Alert tone="danger">{error}</Alert>}

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
              <label className="mb-1.5 block text-xs font-semibold text-[#3A4741] dark:text-surface-text/80">
                Upload From PC <span className="text-xs font-normal text-[#98A59F]">(optional)</span>
              </label>

              {imagePreview ? (
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Selected banner preview"
                    className="h-40 w-auto max-w-full rounded-xl border border-line object-cover dark:border-surface-border"
                  />
                  <button
                    type="button"
                    onClick={removeSelectedImage}
                    className="absolute -top-2 -right-2 p-1 rounded-full bg-[#D9534F] text-white transition-colors hover:bg-[#B3261E]"
                    aria-label="Remove selected image"
                  >
                    <FiX className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-32 w-full cursor-pointer rounded-xl border-2 border-dashed border-line-strong bg-[#F4F7F5] transition-colors hover:border-primary-600 dark:border-surface-border-strong dark:bg-surface-raised dark:hover:border-brand-lime">
                  <FiUpload className="mb-2 h-7 w-7 text-[#98A59F]" />
                  <span className="text-[13px] text-[#5B6963] dark:text-surface-muted">Click to choose image from your computer</span>
                  <span className="mt-1 text-xs text-[#98A59F]">JPEG, PNG, WebP or GIF · max 5 MB</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleImageChange}
                    className="sr-only"
                  />
                </label>
              )}

              {imageUrl && !imageFile && (
                <p className="mt-2 text-xs text-[#7B8983] dark:text-surface-muted">Using image URL from the field above.</p>
              )}
            </div>

            <Input
              label="Link"
              {...register('link')}
              placeholder="https://example.com (Optional)"
              className="md:col-span-2"
            />
            <Input
              label="Start Date"
              type="date"
              {...register('startDate')}
            />
            <Input
              label="End Date"
              type="date"
              {...register('endDate')}
            />
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
        </Card>

        <div className="sticky bottom-0 z-10 -mx-1 mt-4 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none border-t border-line bg-white/90 px-1 py-3 backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
          <Button type="button" variant="secondary" onClick={() => navigate(ROUTES.SOCIAL.BANNERS)}>
            <FiX className="h-4 w-4" />
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting || isUploadingImage}>
            <FiSave className="h-4 w-4" />
            {isUploadingImage ? 'Uploading Image...' : 'Create Banner'}
          </Button>
        </div>
      </form>
    </div>
  );
}
