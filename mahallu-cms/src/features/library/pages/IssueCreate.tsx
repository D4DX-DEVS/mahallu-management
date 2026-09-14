import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import { PageSkeleton } from '@/components/ui/Skeleton';
import SearchableSelect from '@/components/ui/SearchableSelect';
import QuickAddMember from '@/components/quick-add/QuickAddMember';
import { libraryService, LibraryBook } from '@/services/libraryService';
import { memberService } from '@/services/memberService';
import { toast } from '@/store/toastStore';
import { FiArrowLeft, FiPlus } from 'react-icons/fi';
import { errorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';
import PageHeader from '@/components/layout/PageHeader';

const issueSchema = z.object({
  bookId: z.string().max(200, 'Please keep the book to 200 characters or less.').min(1, 'Book is required'),
  memberId: z.string().max(200, 'Please keep the member to 200 characters or less.').min(1, 'Member is required'),
  dueDate: z.string().max(200, 'Please keep the due date to 200 characters or less.').min(1, 'Due date is required'),
});

type IssueFormData = z.infer<typeof issueSchema>;

export default function IssueCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [submitting, setSubmitting] = useState(false);
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [members, setMembers] = useState<any[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<IssueFormData>({
    resolver: zodResolver(issueSchema),
  });

  // Fetch available physical books
  useEffect(() => {
    const fetchBooks = async () => {
      try {
        const result = await libraryService.getBooks({
          resourceType: 'physical',
          status: 'active',
          limit: 100,
        });
        setBooks(result.data.filter((b) => b.availableCopies! > 0));
      } catch (error) {
        console.error("Couldn't load books:", error);
      } finally {
        setLoadingBooks(false);
      }
    };

    fetchBooks();
  }, []);

  // Fetch initial members on mount
  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const result = await memberService.getAll({ limit: 20 });
        setMembers(result.data || []);
      } catch (error) {
        console.error("Couldn't load members:", error);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchMembers();
  }, []);

  // Preselect book from state if provided
  useEffect(() => {
    const state = location.state as { bookId?: string } | null;
    if (state?.bookId && books.length > 0) {
      setValue('bookId', state.bookId, { shouldValidate: true });
    }
  }, [books, location.state, setValue]);

  const handleMemberSearch = async (query: string) => {
    if (!query.trim()) {
      const result = await memberService.getAll({ limit: 20 });
      setMembers(result.data || []);
      return;
    }
    try {
      const result = await memberService.getAll({ search: query, limit: 20 });
      setMembers(result.data || []);
    } catch (error) {
      console.error('Member search failed:', error);
    }
  };

  const onSubmit = async (data: IssueFormData) => {
    try {
      setSubmitting(true);
      await libraryService.createIssue({
        bookId: data.bookId,
        memberId: data.memberId,
        dueDate: new Date(data.dueDate).toISOString(),
      });
      toast.success('Book issued');
      navigate('/library/issues');
    } catch (error: any) {
      toast.error(errorMessage(error, { action: 'create issue' }));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingBooks || loadingMembers) return <PageSkeleton />;

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate('/library/issues')}
        className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
      >
        <FiArrowLeft size={18} />
        Back to Issues
      </button>

      <Card padding="lg" className="max-w-2xl">
        <PageHeader title="Issue Book to Member" />
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Book Selection */}
          <div>
            <label className="block text-sm font-medium mb-2">Select Book *</label>
            <select
              aria-label="Select Book"
              {...register('bookId')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a book...</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title} - {toTitleCase(book.author)} ({book.availableCopies}/{book.copies} available)
                </option>
              ))}
            </select>
            {errors.bookId && <p className="text-red-500 text-sm mt-1">{errors.bookId.message}</p>}
          </div>

          {/* Member Selection */}
          <div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <SearchableSelect
                  label="Select Member *"
                  placeholder="Search by name..."
                  value={watch('memberId')}
                  onChange={(v) => setValue('memberId', v, { shouldValidate: true })}
                  options={members.map((m) => ({ value: m.id, label: toTitleCase(m.name) }))}
                  onSearch={handleMemberSearch}
                  error={errors.memberId?.message}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddMemberOpen(true)}
                title="Add a new member"
              >
                <FiPlus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-sm font-medium mb-2">Due Date *</label>
            <Input {...register('dueDate')} type="date" error={errors.dueDate?.message} />
            <p className="text-xs text-gray-500 mt-1">Set when the book should be returned</p>
          </div>

          {/* Buttons */}
          <div className="flex flex-wrap gap-3 pt-4">
            <Button type="submit" disabled={submitting} onClick={handleSubmit(onSubmit)}>
              {submitting ? 'Creating...' : 'Issue Book'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => navigate('/library/issues')}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>

      <QuickAddMember
        open={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        onCreated={(newMember) => {
          setMembers((prev) => [...prev, newMember]);
          setValue('memberId', newMember.id, { shouldValidate: true });
        }}
      />
    </div>
  );
}
