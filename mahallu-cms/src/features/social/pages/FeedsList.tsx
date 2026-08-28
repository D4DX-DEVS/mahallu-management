import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiX, FiRss, FiCheckCircle } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import { PageSkeleton } from '@/components/ui/Skeleton';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { socialService, Feed } from '@/services/socialService';
import { formatDate } from '@/utils/format';
import { ROUTES } from '@/constants/routes';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';

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
      setError(err.response?.data?.message || 'Failed to fetch feeds');
      console.error('Error fetching feeds:', err);
      setFeeds([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      
      const params: any = { limit: 10000 };
      if (typeFilter === 'super') {
        params.isSuperFeed = true;
      } else if (typeFilter === 'regular') {
        params.isSuperFeed = false;
      }
      
      const result = await socialService.getAllFeeds(params);
      const dataToExport = Array.isArray(result.data) ? result.data : [];

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
      toast.error(error?.response?.data?.message || 'Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<Feed>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'title', label: 'Title', sortable: true },
    {
      key: 'isSuperFeed',
      label: 'Type',
      render: (isSuper) => (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
          {isSuper ? 'Super Feed' : 'Regular'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (status) => {
        const statusColors: Record<string, string> = {
          draft: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
          published: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
          archived: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
        };
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status || 'draft']}`}>
            {status || 'draft'}
          </span>
        );
      },
    },
    {
      key: 'createdAt',
      label: 'Created',
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Feeds</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Manage feeds and super feeds</p>
          </div>
          <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Feeds' }]} />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      <Card>
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
              <Button size="md">
                + New Feed
              </Button>
            </Link>
          }
        />

        {isFilterVisible && (
          <div className="relative flex flex-wrap items-center gap-4 mb-6 p-4 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700">
            <button
              onClick={() => setIsFilterVisible(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <FiX className="h-4 w-4" />
            </button>
            <div className="w-48">
              <Select
                options={[
                  { value: 'all', label: 'All Feeds' },
                  { value: 'regular', label: 'Regular Feeds' },
                  { value: 'super', label: 'Super Feeds' },
                ]}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              />
            </div>
          </div>
        )}

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchFeeds} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <>
            <Table columns={columns} data={feeds} emptyMessage="No feeds found" showExport={false} />
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-6">
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
      </Card>
    </div>
  );
}

