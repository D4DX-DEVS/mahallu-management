import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import { libraryService, LibraryBook } from '@/services/libraryService';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

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
          toast.error(getFriendlyError(error, "Couldn't load book. Try again in a moment."));
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
        toast.success('Book updated');
      } else {
        await libraryService.createBook({
          ...data,
          availableCopies: data.copies,
        });
        toast.success('Book created');
      }

      navigate('/library/books');
    } catch (error: any) {
      toast.error(getFriendlyError(error, "Couldn't save book. Check the details and try again."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const cardTitle = 'text-[13px] font-bold text-[#18231E] dark:text-surface-text';
  const cardDesc = 'mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted';

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title={isEdit ? 'Edit book' : 'Add new book'}
        description="Library catalogue entry"
      />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Title */}
        <Card padding="lg">
          <h2 className={cardTitle}>Book details</h2>
          <p className={cardDesc}>Title, author and category</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Title *"
              {...register('title')}
              placeholder="Book title"
              error={errors.title?.message}
            />
            <Input label="Title (Malayalam)" {...register('titleMl')} placeholder="Malayalam title" />

            {/* Author */}
            <div className="md:col-span-2">
              <Input
                label="Author *"
                {...register('author')}
                placeholder="Author name"
                error={errors.author?.message}
              />
            </div>

            {/* Category & Resource Type */}
            <Select
              label="Category *"
              {...register('category')}
              value={watch('category') || ''}
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
            <Select
              label="Type *"
              {...register('resourceType')}
              options={[
                { value: 'physical', label: 'Physical' },
                { value: 'digital', label: 'Digital' },
              ]}
              error={errors.resourceType?.message}
              onChange={(e) => setResourceType(e.target.value as 'physical' | 'digital')}
            />
          </div>
        </Card>

        {/* Physical Book Fields */}
        {watchResourceType === 'physical' && (
          <Card padding="lg">
            <h2 className={cardTitle}>Physical copies</h2>
            <p className={cardDesc}>ISBN and number of copies on the shelf</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label="ISBN" {...register('isbn')} placeholder="ISBN" />
              <Input
                label="Number of Copies"
                {...register('copies', { valueAsNumber: true })}
                type="number"
                min="1"
                placeholder="Number of copies"
              />
            </div>
          </Card>
        )}

        {/* Digital Book Fields */}
        {watchResourceType === 'digital' && (
          <Card padding="lg">
            <h2 className={cardTitle}>Digital resource</h2>
            <p className={cardDesc}>Link to the online copy</p>
            <Input
              label="Resource URL *"
              {...register('resourceUrl')}
              type="url"
              placeholder="https://example.com/book.pdf"
              error={errors.resourceUrl?.message}
            />
          </Card>
        )}

        {/* Status */}
        <Card padding="lg">
          <h2 className={cardTitle}>Availability</h2>
          <p className={cardDesc}>Inactive books are hidden from issuing</p>
          <div className="md:w-1/2">
            <Select
              label="Status *"
              {...register('status')}
              value={watch('status') || ''}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
              error={errors.status?.message}
            />
          </div>
        </Card>

        {/* Buttons */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/library/books')}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} onClick={handleSubmit(onSubmit)}>
            {submitting ? 'Saving...' : isEdit ? 'Update Book' : 'Create Book'}
          </Button>
        </div>
      </form>
    </div>
  );
}
