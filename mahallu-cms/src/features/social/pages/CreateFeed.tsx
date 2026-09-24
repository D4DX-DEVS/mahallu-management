import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiUpload, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { ROUTES } from '@/constants/routes';
import { socialService } from '@/services/socialService';
import { useAuthStore } from '@/store/authStore';
import PageHeader from '@/components/layout/PageHeader';
import { safeApiMessage } from '@/utils/errors';

const feedSchema = z.object({
  title: z
    .string()
    .min(2, 'Title must be between 2 and 200 characters')
    .max(200, 'Title must be between 2 and 200 characters'),
  content: z.string().max(3000, 'Please keep the content to 3000 characters or less.').min(1, 'Content is required'),
  image: z.string().max(200, 'Please keep the image to 200 characters or less.').optional(),
  isSuperFeed: z.enum(['true', 'false']),
  status: z.enum(['draft', 'published', 'archived']),
});

type FeedFormData = z.infer<typeof feedSchema>;

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function CreateFeed() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
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
  } = useForm<FeedFormData>({
    resolver: zodResolver(feedSchema),
    defaultValues: {
      isSuperFeed: 'false',
      status: 'published',
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

  const onSubmit = async (data: FeedFormData) => {
    if (!user) {
      setError('Could not determine the current user. Please sign in again.');
      return;
    }

    try {
      setError(null);

      let feedImage = data.image?.trim();
      if (imageFile) {
        setIsUploadingImage(true);
        feedImage = await socialService.uploadBannerImage(imageFile);
      }

      const feedData: any = {
        title: data.title,
        content: data.content,
        authorId: user.id,
        isSuperFeed: data.isSuperFeed === 'true',
        status: data.status,
      };
      if (feedImage) feedData.image = feedImage;

      await socialService.createFeed(feedData);
      navigate(ROUTES.SOCIAL.FEEDS);
    } catch (err: unknown) {
      const apiMessage = safeApiMessage(err, '');
      setError(apiMessage || "Couldn't create feed. Please try again.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Create Feed"
        description="Post a new feed update"
        breadcrumbs={[{ label: 'Feeds', path: ROUTES.SOCIAL.FEEDS }]}
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
              label="Title"
              {...register('title')}
              error={errors.title?.message}
              required
              placeholder="Feed Title"
              className="md:col-span-2"
            />

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Content <span className="text-red-500">*</span>
              </label>
              <textarea
                aria-label="Content"
                {...register('content')}
                placeholder="Write the feed content..."
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              {errors.content && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.content.message}</p>
              )}
            </div>

            <Input
              label="Image URL"
              {...register('image')}
              error={errors.image?.message}
              placeholder="https://example.com/image.jpg (optional if file is uploaded)"
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
                    alt="Selected feed image preview"
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

            <Select
              label="Feed Type"
              options={[
                { value: 'false', label: 'Regular Feed' },
                { value: 'true', label: 'Super Feed' },
              ]}
              {...register('isSuperFeed')}
            />
            <Select
              label="Status"
              options={[
                { value: 'draft', label: 'Draft' },
                { value: 'published', label: 'Published' },
                { value: 'archived', label: 'Archived' },
              ]}
              {...register('status')}
            />
          </div>

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.SOCIAL.FEEDS)}>
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting || isUploadingImage}>
              <FiSave className="h-4 w-4 mr-2" />
              {isUploadingImage ? 'Uploading Image...' : 'Create Feed'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
