import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import SearchableSelect from '@/components/ui/SearchableSelect';
import QuickAddMember from '@/components/quick-add/QuickAddMember';
import { libraryService, LibraryBook } from '@/services/libraryService';
import { memberService } from '@/services/memberService';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { FiPlus } from 'react-icons/fi';

const issueSchema = z.object({
  bookId: z.string().min(1, 'Book is required'),
  memberId: z.string().min(1, 'Member is required'),
  dueDate: z.string().min(1, 'Due date is required'),
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
        console.error('Failed to fetch books:', error);
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
        console.error('Failed to fetch members:', error);
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
      console.error('Failed to search members:', error);
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
      toast.error(getFriendlyError(error, "Couldn't create issue. Check the details and try again."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingBooks || loadingMembers) return <LoadingSpinner />;

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="Issue book to member" description="Lend a physical book and set its return date" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Issue details</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Book, member and due date</p>
          <div className="space-y-4">
            {/* Book Selection */}
            <Select
              label="Select Book *"
              {...register('bookId')}
              value={watch('bookId') || ''}
              options={[
                { value: '', label: 'Choose a book...' },
                ...books.map((book) => ({
                  value: book.id,
                  label: `${book.title} - ${book.author} (${book.availableCopies}/${book.copies} available)`,
                })),
              ]}
              error={errors.bookId?.message}
            />

            {/* Member Selection */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <SearchableSelect
                  label="Select Member *"
                  placeholder="Search by name..."
                  value={watch('memberId')}
                  onChange={(v) => setValue('memberId', v, { shouldValidate: true })}
                  options={members.map((m) => ({ value: m.id, label: m.name }))}
                  onSearch={handleMemberSearch}
                  error={errors.memberId?.message}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                iconOnly
                onClick={() => setAddMemberOpen(true)}
                title="Add a new member"
                aria-label="Add a new member"
              >
                <FiPlus className="h-4 w-4" />
              </Button>
            </div>

            {/* Due Date */}
            <Input
              label="Due Date *"
              {...register('dueDate')}
              type="date"
              error={errors.dueDate?.message}
              helperText="Set when the book should be returned"
            />
          </div>
        </Card>

        {/* Buttons */}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/library/issues')}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} onClick={handleSubmit(onSubmit)}>
            {submitting ? 'Creating...' : 'Issue Book'}
          </Button>
        </div>
      </form>

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
