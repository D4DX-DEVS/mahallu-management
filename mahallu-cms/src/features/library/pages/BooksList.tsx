import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import Badge from '@/components/ui/Badge';
import { PageSkeleton } from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { libraryService, LibraryBook } from '@/services/libraryService';
import { toast } from '@/store/toastStore';
import BulkImportBooks from '../components/BulkImportBooks';
import { FiPlus, FiEdit2, FiTrash2, FiUpload, FiFileText } from 'react-icons/fi';

export default function BooksList() {
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
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

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

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await libraryService.deleteBook(deleteId);
      setBooks(books.filter((b) => b._id !== deleteId));
      toast.success('Book deleted successfully');
      setConfirmDelete(false);
      setDeleteId(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete book');
      setConfirmDelete(false);
      setDeleteId(null);
    }
  };

  const getAvailabilityBadge = (book: LibraryBook) => {
    if (book.resourceType === 'digital') {
      return <Badge color="blue">Digital</Badge>;
    }
    const percent = book.copies ? Math.round((book.availableCopies! / book.copies) * 100) : 0;
    return (
      <Badge color={percent > 0 ? 'green' : 'red'}>
        {book.availableCopies}/{book.copies} available
      </Badge>
    );
  };

  const columns = [
    {
      key: 'title',
      label: 'Title',
      render: (book: LibraryBook) => (
        <div>
          <div className="font-medium">{book.title}</div>
          {book.titleMl && <div className="text-xs text-gray-500">{book.titleMl}</div>}
        </div>
      ),
    },
    { key: 'author', label: 'Author' },
    {
      key: 'category',
      label: 'Category',
      render: (book: LibraryBook) => (
        <Badge color="purple">{book.category}</Badge>
      ),
    },
    {
      key: 'availability',
      label: 'Availability',
      render: (book: LibraryBook) => getAvailabilityBadge(book),
    },
    {
      key: 'status',
      label: 'Status',
      render: (book: LibraryBook) => (
        <Badge color={book.status === 'active' ? 'green' : 'gray'}>{book.status}</Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (book: LibraryBook) => (
        <div className="flex gap-2">
          {book.resourceType === 'physical' && book.availableCopies! > 0 && (
            <button
              onClick={() => navigate('/library/issues/create', { state: { bookId: book._id } })}
              className="text-green-600 hover:text-green-800"
              title="Issue this book to a member"
            >
              <FiFileText size={16} />
            </button>
          )}
          <button
            onClick={() => navigate(`/library/books/${book._id}/edit`)}
            className="text-blue-600 hover:text-blue-800"
          >
            <FiEdit2 size={16} />
          </button>
          <button
            onClick={() => {
              setDeleteId(book._id);
              setConfirmDelete(true);
            }}
            className="text-red-600 hover:text-red-800"
          >
            <FiTrash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">Library Books</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <FiUpload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button onClick={() => navigate('/library/books/create')}>
            <FiPlus className="h-4 w-4 mr-2" />
            Add Book
          </Button>
        </div>
      </div>

      <BulkImportBooks
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => setRefreshKey((k) => k + 1)}
      />

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <Input
          type="text"
          placeholder="Search by title or author..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
        />
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

      {/* Books Table */}
      {loading ? (
        <PageSkeleton variant="section" />
      ) : (
        <>
          <Table columns={columns} data={books} />
          {pagination && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete Book"
        message="Delete this book? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => {
          setConfirmDelete(false);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
