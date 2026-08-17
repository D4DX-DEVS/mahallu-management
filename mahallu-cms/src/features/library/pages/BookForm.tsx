import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Card from '@/components/ui/Card';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { libraryService, LibraryBook } from '@/services/libraryService';
import { toast } from '@/store/toastStore';
import { FiArrowLeft } from 'react-icons/fi';

const bookSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  titleMl: z.string().optional(),
  author: z.string().min(1, 'Author is required'),
  category: z.enum(['quran', 'hadith', 'fiqh', 'history', 'children', 'women', 'youth', 'general']),
  resourceType: z.enum(['physical', 'digital']),
  resourceUrl: z.string().optional(),
  isbn: z.string().optional(),
  copies: z.number().optional(),
  status: z.enum(['active', 'inactive']),
}).refine(
  (data) => data.resourceType !== 'digital' || data.resourceUrl,
  {
    message: 'Resource URL is required for digital books',
    path: ['resourceUrl'],
  }
);

type BookFormData = z.infer<typeof bookSchema>;

interface BookFormProps {
  isEdit?: boolean;
}

export default function BookForm({ isEdit = false }: BookFormProps) {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [resourceType, setResourceType] = useState<'physical' | 'digital'>('physical');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<BookFormData>({
    resolver: zodResolver(bookSchema),
    defaultValues: {
      resourceType: 'physical',
      status: 'active',
    },
  });

  const watchResourceType = watch('resourceType');

  // Fetch book if editing
  useEffect(() => {
    if (isEdit && id) {
      const fetchBook = async () => {
        try {
          const book = await libraryService.getBookById(id);
          reset({
            title: book.title,
            titleMl: book.titleMl,
            author: book.author,
            category: book.category,
            resourceType: book.resourceType,
            resourceUrl: book.resourceUrl,
            isbn: book.isbn,
            copies: book.copies,
            status: book.status,
          });
          setResourceType(book.resourceType);
        } catch (error) {
          console.error('Failed to fetch book:', error);
          toast.error('Failed to load book');
          navigate('/library/books');
        } finally {
          setLoading(false);
        }
      };

      fetchBook();
    }
  }, [isEdit, id, reset, navigate]);

  const onSubmit = async (data: BookFormData) => {
    try {
      setSubmitting(true);

      if (isEdit && id) {
        await libraryService.updateBook(id, data);
        toast.success('Book updated successfully');
      } else {
        await libraryService.createBook({
          ...data,
          availableCopies: data.copies,
        });
        toast.success('Book created successfully');
      }

      navigate('/library/books');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save book');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate('/library/books')}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
      >
        <FiArrowLeft size={18} />
        Back to Books
      </button>

      <Card className="p-6">
        <h1 className="text-2xl font-bold mb-6">
          {isEdit ? 'Edit Book' : 'Add New Book'}
        </h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Title */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Title *</label>
              <Input
                {...register('title')}
                placeholder="Book title"
                error={errors.title?.message}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Title (Malayalam)</label>
              <Input {...register('titleMl')} placeholder="Malayalam title" />
            </div>
          </div>

          {/* Author */}
          <div>
            <label className="block text-sm font-medium mb-2">Author *</label>
            <Input
              {...register('author')}
              placeholder="Author name"
              error={errors.author?.message}
            />
          </div>

          {/* Category & Resource Type */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Category *</label>
              <Select
                {...register('category')}
                options={[
                  { value: '', label: 'Select category' },
                  { value: 'quran', label: 'Quran' },
                  { value: 'hadith', label: 'Hadith' },
                  { value: 'fiqh', label: 'Fiqh' },
                  { value: 'history', label: 'History' },
                  { value: 'children', label: 'Children' },
                  { value: 'women', label: 'Women' },
                  { value: 'youth', label: 'Youth' },
                  { value: 'general', label: 'General' },
                ]}
                error={errors.category?.message}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Type *</label>
              <Select
                {...register('resourceType')}
                options={[
                  { value: 'physical', label: 'Physical' },
                  { value: 'digital', label: 'Digital' },
                ]}
                error={errors.resourceType?.message}
                onChange={(e) => setResourceType(e.target.value as 'physical' | 'digital')}
              />
            </div>
          </div>

          {/* Physical Book Fields */}
          {watchResourceType === 'physical' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">ISBN</label>
                <Input {...register('isbn')} placeholder="ISBN" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Number of Copies</label>
                <Input
                  {...register('copies', { valueAsNumber: true })}
                  type="number"
                  min="1"
                  placeholder="Number of copies"
                />
              </div>
            </div>
          )}

          {/* Digital Book Fields */}
          {watchResourceType === 'digital' && (
            <div>
              <label className="block text-sm font-medium mb-2">Resource URL *</label>
              <Input
                {...register('resourceUrl')}
                type="url"
                placeholder="https://example.com/book.pdf"
                error={errors.resourceUrl?.message}
              />
            </div>
          )}

          {/* Status */}
          <div>
            <label className="block text-sm font-medium mb-2">Status *</label>
            <Select
              {...register('status')}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              error={errors.status?.message}
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              type="submit"
              disabled={submitting}
              onClick={handleSubmit(onSubmit)}
            >
              {submitting ? 'Saving...' : isEdit ? 'Update Book' : 'Create Book'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/library/books')}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
