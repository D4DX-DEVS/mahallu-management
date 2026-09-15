import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiCheckCircle, FiPlus, FiRss } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import FilterPanel from '@/components/ui/FilterPanel';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import { PageSkeleton } from '@/components/ui/Skeleton';
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

export default function FeedsList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedFeed, setSelectedFeed] = useState<Feed | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  useEffect(() => {
    fetchFeeds();
  }, [typeFilter, currentPage]);

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
      console.error('Error fetching feeds:', err);
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
          exportToPDF(columns, dataToExport, filename, title);
          break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(errorMessage(error, { action: 'export data' }));
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<Feed>[] = [
    { key: 'title', label: 'Title', width: '6.25rem', sortable: true },
    {
      key: 'isSuperFeed',
      label: 'Type',
      width: '6.25rem',
      render: (isSuper) => (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
          {isSuper ? 'Super Feed' : 'Regular'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '7.25rem',
      render: (status) => {
        return <StatusBadge status={status} />;
      },
    },
    {
      key: 'createdAt',
      label: 'Created',
      width: '7.75rem',
      render: (date) => formatDate(date),
    },
  ];

  const stats = [
    { title: 'Total Feeds', value: feeds.length, icon: <FiRss className="h-5 w-5" /> },
    {
      title: 'Published',
      value: feeds.filter((f) => f.status === 'published').length,
      icon: <FiCheckCircle className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <PageHeader title="Feeds" description="Manage feeds and super feeds" />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
          isFilterVisible={isFilterVisible}
          hasFilters={true}
          onRefresh={fetchFeeds}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={
            <Link to={ROUTES.SOCIAL.CREATE_FEED}>
              <Button size="md" icon={<FiPlus />} collapseLabel>New Feed</Button>
            </Link>
          }
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-48">
              <Select
                options={[
                  { value: 'all', label: 'All Feeds' },
                  { value: 'regular', label: 'Regular Feeds' },
                  { value: 'super', label: 'Super Feeds' },
                ]}
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </FilterPanel>
        )}

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchFeeds} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <>
            <Table
              fixedLayout
              striped
              columns={columns}
              data={feeds}
              emptyMessage="No feeds found"
              showExport={false}
              onRowClick={(row) => {
                setSelectedFeed(row);
                setShowViewModal(true);
              }}
            />
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
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
    </div>
  );
}
