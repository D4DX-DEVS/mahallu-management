import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import SearchInput from '@/components/ui/SearchInput';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import { Pagination as PaginationType, TableColumn } from '@/types';
import { announcementService, Announcement } from '@/services/announcementService';
import { useDebounce } from '@/hooks/useDebounce';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'sent', label: 'Sent' },
];

export default function AnnouncementsList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationType | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchRows();
  }, [statusFilter, debouncedSearch, currentPage]);

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = { page: currentPage, limit: 10 };
      if (statusFilter) params.status = statusFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const result = await announcementService.getAll(params);
      setRows(result.data);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const columns: TableColumn<Announcement>[] = [
    { key: 'title', label: 'Title' },
    { key: 'category', label: 'Category' },
    { key: 'audience', label: 'Audience' },
    { key: 'channels', label: 'Channels', render: (v) => (Array.isArray(v) ? v.join(', ') : '-') },
    { key: 'status', label: 'Status' },
    {
      key: 'sentAt',
      label: 'Sent',
      render: (v) => (v ? new Date(v).toLocaleDateString() : '-'),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Announcements</h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Broadcast messages to the community
          </p>
        </div>
        <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Announcements' }]} />
      </div>

      <Card>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-3 gap-1.5 sm:flex">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value || 'all'}
                onClick={() => {
                  setStatusFilter(tab.value);
                  setCurrentPage(1);
                }}
                className={[
                  'rounded-lg border px-2 py-1.5 text-xs font-medium',
                  statusFilter === tab.value
                    ? 'border-primary-300 bg-primary-50 text-primary-900'
                    : 'border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="w-full sm:w-56">
              <SearchInput
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search..."
              />
            </div>
            <Link to="/announcements/create">
              <Button size="md" className="w-full sm:w-auto">
                + New Announcement
              </Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchRows} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table
              columns={columns}
              data={rows}
              emptyMessage="No announcements yet"
              showExport={false}
              onRowClick={(row) => navigate(`/announcements/${row._id}`)}
            />
          </div>
        )}

        {pagination && (
          <div className="mt-4">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
