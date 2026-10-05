import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import ExpandableSearch from '@/components/ui/ExpandableSearch';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import Badge from '@/components/ui/Badge';
import { PageSkeleton } from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import { libraryService, LibraryBook } from '@/services/libraryService';
import { toast } from '@/store/toastStore';
import BulkImportBooks from '../components/BulkImportBooks';
import { FiPlus, FiUpload, FiFileText } from 'react-icons/fi';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

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
  const [selectedBook, setSelectedBook] = useState<LibraryBook | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

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
        console.error("Couldn't load books:", error);
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
      setBooks(books.filter((b) => b.id !== deleteId));
      toast.success('Book deleted');
      setConfirmDelete(false);
      setDeleteId(null);
    } catch (error: any) {
      toast.error(errorMessage(error, { action: 'delete book' }));
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
      render: (_: any, book: LibraryBook) => (
        <div>
          <div className="font-medium">{book.title}</div>
          {book.titleMl && <div className="text-xs text-gray-500">{book.titleMl}</div>}
        </div>
      ),
    },
    { key: 'author', label: 'Author', render: (_: any, book: LibraryBook) => toTitleCase(book.author) },
    {
      key: 'category',
      label: 'Category',
      render: (_: any, book: LibraryBook) => <Badge color="purple">{book.category}</Badge>,
    },
    {
      key: 'availability',
      label: 'Availability',
      render: (_: any, book: LibraryBook) => getAvailabilityBadge(book),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_: any, book: LibraryBook) => (
        <Badge color={book.status === 'active' ? 'green' : 'gray'}>{book.status}</Badge>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-4 items-center">
        <PageHeader title="Library Books" />
        <div className="flex gap-2 items-center">
          <Button variant="secondary" onClick={() => setImportOpen(true)} icon={<FiUpload />} collapseLabel>Import CSV</Button>
          <Button onClick={() => navigate('/library/books/create')} icon={<FiPlus />} collapseLabel>Add Book</Button>
        </div>
      </div>

      <BulkImportBooks
        isOpen={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => setRefreshKey((k) => k + 1)}
      />

      {/* Filters */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <ExpandableSearch
          value={search}
          onChange={(value) => {
            setSearch(value);
            setCurrentPage(1);
          }}
          entity="books"
          placeholder="Search by title or author"
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
          <Table
            fixedLayout
            striped
            columns={columns}
            data={books}
            onRowClick={(book) => {
              setSelectedBook(book);
              setShowViewModal(true);
            }}
          />
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

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedBook(null);
        }}
        title="Book Details"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowViewModal(false);
                setSelectedBook(null);
              }}
            >
              Close
            </Button>
            {selectedBook?.resourceType === 'physical' && (selectedBook.availableCopies ?? 0) > 0 && (
              <Button
                variant="outline"
                icon={<FiFileText />}
                onClick={() => {
                  if (selectedBook) navigate('/library/issues/create', { state: { bookId: selectedBook.id } });
                }}
              >
                Issue
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                if (selectedBook) navigate(`/library/books/${selectedBook.id}/edit`);
              }}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (selectedBook) setDeleteId(selectedBook.id);
                setShowViewModal(false);
                setConfirmDelete(true);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        {selectedBook && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Title</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">{selectedBook.title}</p>
              {selectedBook.titleMl && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{selectedBook.titleMl}</p>
              )}
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Author</p>
              <p className="text-gray-900 dark:text-gray-100">{toTitleCase(selectedBook.author)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Category</p>
              <p className="text-gray-900 dark:text-gray-100">{selectedBook.category}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Type</p>
              <p className="text-gray-900 dark:text-gray-100 capitalize">{selectedBook.resourceType}</p>
            </div>
            {selectedBook.resourceType === 'digital' && selectedBook.resourceUrl && (
              <div className="sm:col-span-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">Resource URL</p>
                <p className="text-gray-900 dark:text-gray-100 break-all">{selectedBook.resourceUrl}</p>
              </div>
            )}
            {selectedBook.resourceType === 'physical' && selectedBook.isbn && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">ISBN</p>
                <p className="text-gray-900 dark:text-gray-100">{selectedBook.isbn}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Availability</p>
              <p className="text-gray-900 dark:text-gray-100">{getAvailabilityBadge(selectedBook)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
              <p className="text-gray-900 dark:text-gray-100 capitalize">{selectedBook.status}</p>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isLoading={loading}
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
