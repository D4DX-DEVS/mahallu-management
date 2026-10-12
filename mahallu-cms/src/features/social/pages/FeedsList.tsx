import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiRss, FiCheckCircle } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import Badge from '@/components/ui/Badge';
import StatusBadge from '@/components/ui/StatusBadge';
import ListToolbar from '../components/ListToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { socialService, Feed } from '@/services/socialService';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { monthlySeries, shareViz } from '@/utils/statSeries';

export default function FeedsList() {
  const [searchQuery, setSearchQuery] = useState('');
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
      setError(getFriendlyError(err, "Couldn't load feeds. Refresh the page or try again."));
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
        toast.info('Nothing to export. Change your filters and try again.');
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
      toast.error(getFriendlyError(error, "Couldn't export data. Check your connection and try again."));
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
      render: (isSuper) => <Badge variant={isSuper ? 'solid' : 'neutral'}>{isSuper ? 'Super Feed' : 'Regular'}</Badge>,
    },
    {
      key: 'status',
      label: 'Status',
      render: (status) => <StatusBadge status={status || 'draft'} />,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (date) => formatDate(date),
    },
  ];

  const stats = [
    { title: 'Total Feeds', value: feeds.length, viz: monthlySeries(feeds as any[], (r: any) => r.createdAt).length ? { type: 'bars' as const, values: monthlySeries(feeds as any[], (r: any) => r.createdAt) } : undefined, icon: <FiRss className="h-[17px] w-[17px]" />, tone: 'green' as const },
    {
      title: 'Published',
      value: feeds.filter((f) => f.status === 'published').length, viz: shareViz(feeds.filter((f) => f.status === 'published').length, feeds.length), summary: `Published: ${feeds.filter((f) => f.status === 'published').length} of ${feeds.length}`,
      icon: <FiCheckCircle className="h-[17px] w-[17px]" />,
      tone: 'lime' as const,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Feeds"
        description="Manage feeds and super feeds"
        actions={
          <Link to="/social/feeds/create">
            <Button>+ New feed</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {stats.map((stat, index) => (
          <StatCard key={index} variant="inline" {...stat} />
        ))}
      </div>

      <Card padding="none" className="overflow-visible">
        <ListToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search feeds"
          onRefresh={fetchFeeds}
          onExport={handleExport}
          isExporting={isExporting}
        >
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
        </ListToolbar>

        <div className="p-3.5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <Button onClick={fetchFeeds} className="mt-4" variant="outline">
                Retry
              </Button>
            </div>
          ) : (
            <>
              <Table columns={columns} data={feeds} emptyMessage="No feeds found" showExport={false} />
              {pagination && pagination.totalPages > 1 && (
                <div className="mt-3.5">
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
        </div>
      </Card>
    </div>
  );
}

