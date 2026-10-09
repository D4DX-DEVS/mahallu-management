import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import FilterPanel from '@/components/ui/FilterPanel';
import EmptyState from '@/components/ui/EmptyState';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import Badge from '@/components/ui/Badge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import { libraryService, LibraryBook } from '@/services/libraryService';
import { toast } from '@/store/toastStore';
import BulkImportBooks from '../components/BulkImportBooks';
import { FiPlus, FiUpload, FiFileText } from 'react-icons/fi';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

export default function BooksList() {
  const navigate = useNavigate();
  const [books, setBooks] = useState<LibraryBook[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
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

  const fetchBooks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await libraryService.getBooks({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch,
        category: category || undefined,
        resourceType: resourceType || undefined,
      });
      setBooks(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError(loadErrorMessage(err, 'books'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearch, category, resourceType]);

  useEffect(() => {
    fetchBooks();
  }, [fetchBooks, refreshKey]);

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
      return <Badge variant="info">Digital</Badge>;
    }
    const percent = book.copies ? Math.round((book.availableCopies! / book.copies) * 100) : 0;
    return (
      <Badge variant={percent > 0 ? 'success' : 'danger'}>
        {book.availableCopies}/{book.copies} available
      </Badge>
    );
  };

  const columns = [
    {
      key: 'title',
      label: 'Title',
      sortable: true,
      width: '18rem',
      render: (_: any, book: LibraryBook) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{book.title}</div>
          {book.titleMl && <div className="truncate text-xs text-muted-foreground">{book.titleMl}</div>}
        </div>
      ),
    },
    { key: 'author', label: 'Author', sortable: true, width: '12rem', render: (_: any, book: LibraryBook) => toTitleCase(book.author) },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      priority: 'secondary' as const,
      width: '9rem',
      render: (_: any, book: LibraryBook) => <Badge variant="primary" className="capitalize">{book.category}</Badge>,
    },
    {
      key: 'availability',
      label: 'Availability',
      sortable: false,
      width: '12rem',
      render: (_: any, book: LibraryBook) => getAvailabilityBadge(book),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      priority: 'secondary' as const,
      width: '8rem',
      render: (_: any, book: LibraryBook) => (
        <Badge variant={book.status === 'active' ? 'success' : 'neutral'} className="capitalize">{book.status}</Badge>
      ),
    },
  ];

  const activeFilterCount = (category ? 1 : 0) + (resourceType ? 1 : 0);
  const isFiltered = Boolean(debouncedSearch) || activeFilterCount > 0;
  const clearFilters = () => {
    setCategory('');
    setResourceType('');
    setCurrentPage(1);
  };

  return (
    <>
      <PageHeader
        title="Library books"
        description="Books and digital resources in the mosque library."
        actions={
          <>
            <Button variant="outline" icon={<FiUpload />} collapseLabel onClick={() => setImportOpen(true)}>
              Import CSV
            </Button>
            <Button icon={<FiPlus />} collapseLabel onClick={() => navigate('/library/books/create')}>
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

      <TableCard>
        <TableToolbar
          searchQuery={search}
          onSearchChange={(value) => {
            setSearch(value);
            setCurrentPage(1);
          }}
          searchEntity="books"
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={activeFilterCount}
          onRefresh={fetchBooks}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-52">
              <Select
                label="Category"
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value);
                  setCurrentPage(1);
                }}
                options={[
                  { value: '', label: 'All categories' },
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
            <div className="w-full sm:w-52">
              <Select
                label="Type"
                value={resourceType}
                onChange={(e) => {
                  setResourceType(e.target.value);
                  setCurrentPage(1);
                }}
                options={[
                  { value: '', label: 'All types' },
                  { value: 'physical', label: 'Physical' },
                  { value: 'digital', label: 'Digital' },
                ]}
              />
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </FilterPanel>
        )}

        {error ? (
          <EmptyState variant="error" entity="books" description={error} action={{ label: 'Try again', onClick: fetchBooks }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={books}
              isLoading={loading}
              entity="books"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearch(''); clearFilters(); } }
                  : { label: 'Add book', onClick: () => navigate('/library/books/create') }
              }
              onRowClick={(book) => {
                setSelectedBook(book);
                setShowViewModal(true);
              }}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="books"
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(size) => {
                    setItemsPerPage(size);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
          </>
        )}
      </TableCard>

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
        title="Delete this book?"
        message="This permanently removes the book and cannot be undone."
        confirmLabel="Delete book"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => {
          setConfirmDelete(false);
          setDeleteId(null);
        }}
      />
    </>
  );
}
