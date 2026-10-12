import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { TableColumn } from '@/types';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import RowActions from '@/components/ui/RowActions';
import Pagination from '@/components/ui/Pagination';
import Badge from '@/components/ui/Badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { libraryService, LibraryBook } from '@/services/libraryService';
import { toast } from '@/store/toastStore';
import BulkImportBooks from '../components/BulkImportBooks';
import { FiPlus, FiUpload, FiFileText } from 'react-icons/fi';
import { useUndoableAction } from '@/hooks/useUndoableAction';
import { PersonCell } from '@/components/ui/Avatar';

export default function BooksList() {
  const undo = useUndoableAction('book');
  const navigate = useNavigate();
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [pagination, setPagination] = useState<any>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch books
  useEffect(() => {
    const fetchBooks = async () => {
      try {
        setLoading(true);
        const result = await libraryService.getBooks({
          page: currentPage,
          limit: itemsPerPage,
          search: debouncedSearch,
          category: category || undefined,
          resourceType: resourceType || undefined,
        });
        setBooks(result.data);
        setPagination(result.pagination);
      } catch (error) {
        console.error('Failed to fetch books:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBooks();
  }, [currentPage, debouncedSearch, category, resourceType, refreshKey]);

  const handleDelete = (book: LibraryBook) => {
    undo.run({
      id: book.id,
      label: `${book.title || 'Book'} deleted`,
      commit: () => libraryService.deleteBook(book.id),
      errorMessage: "Couldn't delete the book. Try again in a moment.",
    });
  };

  const getAvailabilityBadge = (book: LibraryBook) => {
    if (book.resourceType === 'digital') {
      return <Badge variant="info" dot>Digital</Badge>;
    }
    const percent = book.copies ? Math.round((book.availableCopies! / book.copies) * 100) : 0;
    return (
      <Badge variant={percent > 0 ? 'success' : 'danger'} dot>
        {book.availableCopies}/{book.copies} available
      </Badge>
    );
  };

  const columns: TableColumn<LibraryBook>[] = [
    {
      key: 'title',
      label: 'Title',
      render: (_, book) => (
        <PersonCell name={book.title} subtitle={book.titleMl || book.author} />
      ),
    },
    { key: 'author', label: 'Author' },
    {
      key: 'category',
      label: 'Category',
      render: (_, book) => <Badge variant="primary" className="capitalize">{book.category}</Badge>,
    },
    {
      key: 'availability',
      label: 'Availability',
      render: (_, book) => getAvailabilityBadge(book),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, book) => <StatusBadge status={book.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, book) => (
        <RowActions
          onEdit={() => navigate(`/library/books/${book.id}/edit`)}
          onDelete={() => handleDelete(book)}
          ariaLabels={{ edit: 'Edit book', delete: 'Delete book' }}
          extra={[
            {
              label: 'Issue this book to a member',
              icon: <FiFileText />,
              onClick: () => navigate('/library/issues/create', { state: { bookId: book.id } }),
              show: book.resourceType === 'physical' && book.availableCopies! > 0,
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Library books"
        description="Physical and digital books in the mahall library"
        actions={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <FiUpload className="h-3.5 w-3.5" />
              Import CSV
            </Button>
            <Button onClick={() => navigate('/library/books/create')}>
              <FiPlus className="h-3.5 w-3.5" />
              Add book
            </Button>
          </>
        }
      />

      <BulkImportBooks
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => setRefreshKey((k) => k + 1)}
      />

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{
            value: search,
            onChange: (value) => {
              setSearch(value);
              setCurrentPage(1);
            },
            placeholder: 'Search by title or author',
          }}
        >
          <div className="w-44">
            <Select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setCurrentPage(1);
              }}
              options={[
                { value: '', label: 'All Categories' },
                { value: 'quran', label: 'Quran' },
                { value: 'hadith', label: 'Hadith' },
                { value: 'fiqh', label: 'Fiqh' },
                { value: 'history', label: 'History' },
                { value: 'children', label: 'Children' },
                { value: 'women', label: 'Women' },
                { value: 'youth', label: 'Youth' },
                { value: 'general', label: 'General' },
              ]}
            />
          </div>
          <div className="w-36">
            <Select
              value={resourceType}
              onChange={(e) => {
                setResourceType(e.target.value);
                setCurrentPage(1);
              }}
              options={[
                { value: '', label: 'All Types' },
                { value: 'physical', label: 'Physical' },
                { value: 'digital', label: 'Digital' },
              ]}
            />
          </div>
        </FilterBar>

        {/* Books Table */}
        <div className="p-3.5">
          {loading ? (
            <LoadingSpinner />
          ) : (
            <>
              {books.length === 0 ? (
                <EmptyState title="No books found" description="Try adjusting your search or add a new book." />
              ) : (
                <Table columns={columns} data={undo.filterHidden(books, (b) => b.id)} showExport={false} />
              )}
              {pagination && (
                <div className="mt-3.5">
                  <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    totalItems={pagination.total}
                    itemsPerPage={itemsPerPage}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
