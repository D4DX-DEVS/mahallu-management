import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiPlus, FiRss } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import FilterPanel from '@/components/ui/FilterPanel';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import Badge from '@/components/ui/Badge';
import TableToolbar from '@/components/ui/TableToolbar';
import Modal from '@/components/ui/Modal';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { socialService, Feed } from '@/services/socialService';
import { fetchAllPages } from '@/services/api';
import { formatDate } from '@/utils/format';
import { ROUTES } from '@/constants/routes';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';
import { useServerCounts } from '@/hooks/useServerCounts';
import { logError } from '@/utils/safeLog';

export default function FeedsList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState<Feed | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  useEffect(() => {
    fetchFeeds();
  }, [typeFilter, currentPage, itemsPerPage]);

  const fetchFeeds = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
      };
      if (typeFilter === 'super') {
        params.isSuperFeed = true;
      } else if (typeFilter === 'regular') {
        params.isSuperFeed = false;
      }
      const result = await socialService.getAllFeeds(params);
      setFeeds(Array.isArray(result.data) ? result.data : []);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(loadErrorMessage(err, 'feeds'));
      logError('Error fetching feeds', err);
      setFeeds([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);

      const filters: any = {};
      if (typeFilter === 'super') {
        filters.isSuperFeed = true;
      } else if (typeFilter === 'regular') {
        filters.isSuperFeed = false;
      }

      const dataToExport = await fetchAllPages<Feed>(({ page, limit }) =>
        socialService.getAllFeeds({ ...filters, page, limit })
      );

      if (dataToExport.length === 0) {
        toast.info('No data to export');
        return;
      }

      const filename = 'feeds';
      const title = 'All Feeds';

      switch (type) {
        case 'csv':
          exportToCSV(columns, dataToExport, filename);
          break;
        case 'json':
          exportToJSON(columns, dataToExport, filename);
          break;
        case 'pdf':
          await exportToPDF(columns, dataToExport, filename, title);
          break;
      }
    } catch (error: any) {
      logError('Export error', error);
      toast.error(errorMessage(error, { action: 'export data' }));
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<Feed>[] = [
    {
      key: 'title',
      label: 'Title',
      width: '18rem',
      sortable: true,
      render: (title) => <span className="font-medium text-foreground">{title}</span>,
    },
    {
      key: 'isSuperFeed',
      label: 'Type',
      width: '10rem',
      sortable: true,
      render: (isSuper) => <Badge variant={isSuper ? 'primary' : 'neutral'}>{isSuper ? 'Super feed' : 'Regular'}</Badge>,
    },
    {
      key: 'status', sortable: true,
      label: 'Status',
      width: '8rem',
      render: (status) => {
        return <StatusBadge status={status} />;
      },
    },
    {
      key: 'createdAt', sortable: true, priority: 'secondary',
      label: 'Created',
      width: '9rem',
      render: (date) => formatDate(date),
    },
  ];

  // Whole-list counts from the server: these cards used to count only the rows on this page.
  const countBase: { isSuperFeed?: boolean } = {};
  if (typeFilter === 'super') countBase.isSuperFeed = true;
  else if (typeFilter === 'regular') countBase.isSuperFeed = false;
  const statusCounts = useServerCounts(
    { published: () => socialService.getAllFeeds({ ...countBase, status: 'published', page: 1, limit: 1 }) },
    [feeds]
  );

  const stats = [
    { title: 'Total Feeds', value: pagination?.total ?? feeds.length, icon: <FiRss className="h-5 w-5" /> },
    {
      title: 'Published',
      value: statusCounts.published ?? feeds.filter((f) => f.status === 'published').length,
      icon: <FiCheckCircle className="h-5 w-5" />,
    },
  ];

  // The API has no feed search, so this narrows the page already loaded.
  const visibleFeeds = feeds.filter((feed) =>
    (feed.title || '').toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  const activeFilterCount = typeFilter !== 'all' ? 1 : 0;
  const isFiltered = Boolean(searchQuery) || typeFilter !== 'all';

  return (
    <>
      <PageHeader
        title="Feeds"
        description="Manage feeds and super feeds."
        actions={
          <Link to={ROUTES.SOCIAL.CREATE_FEED}>
            <Button icon={<FiPlus />} collapseLabel>New feed</Button>
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchEntity="feeds"
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={activeFilterCount}
          onRefresh={fetchFeeds}
          onExport={handleExport}
          isExporting={isExporting}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-52">
              <Select
                label="Type"
                options={[
                  { value: 'all', label: 'All feeds' },
                  { value: 'regular', label: 'Regular feeds' },
                  { value: 'super', label: 'Super feeds' },
                ]}
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            {typeFilter !== 'all' && (
              <Button
                variant="ghost"
                onClick={() => {
                  setTypeFilter('all');
                  setCurrentPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterPanel>
        )}

        {error ? (
          <EmptyState
            variant="error"
            entity="feeds"
            description={error}
            action={{ label: 'Try again', onClick: fetchFeeds }}
          />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={visibleFeeds}
              isLoading={loading}
              entity="feeds"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); setTypeFilter('all'); setCurrentPage(1); } }
                  : { label: 'Add feed', onClick: () => navigate(ROUTES.SOCIAL.CREATE_FEED) }
              }
              onRowClick={(row) => {
                setSelectedFeed(row);
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
                  entity="feeds"
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
          setSelectedFeed(null);
        }}
        title="Feed Details"
        footer={
          <Button
            variant="outline"
            onClick={() => {
              setShowViewModal(false);
              setSelectedFeed(null);
            }}
          >
            Close
          </Button>
        }
      >
        {selectedFeed && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Title</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">{selectedFeed.title}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Type</p>
              <p className="text-gray-900 dark:text-gray-100">
                {selectedFeed.isSuperFeed ? 'Super Feed' : 'Regular'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
              <p className="text-gray-900 dark:text-gray-100 capitalize">{selectedFeed.status || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Author</p>
              <p className="text-gray-900 dark:text-gray-100">{selectedFeed.authorName || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
              <p className="text-gray-900 dark:text-gray-100">{formatDate(selectedFeed.createdAt)}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Content</p>
              <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{selectedFeed.content}</p>
            </div>
            {selectedFeed.image && (
              <div className="sm:col-span-2">
                <p className="text-xs text-gray-500 dark:text-gray-400">Image</p>
                <img src={selectedFeed.image} alt={selectedFeed.title} className="max-h-40 rounded-md" />
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
