import { useState, useEffect } from 'react';
import { FiPlus } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import ExpandableSearch from '@/components/ui/ExpandableSearch';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import { Pagination as PaginationType, TableColumn } from '@/types';
import { announcementService, Announcement } from '@/services/announcementService';
import { useDebounce } from '@/hooks/useDebounce';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

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
      setError(loadErrorMessage(err, 'announcements'));
    } finally {
      setLoading(false);
    }
  };

  const columns: TableColumn<Announcement>[] = [
    { key: 'title', label: 'Title', width: '6.25rem' },
    { key: 'category', label: 'Category', width: '8.25rem' },
    { key: 'audience', label: 'Audience', width: '8rem' },
    { key: 'channels', label: 'Channels', width: '8rem', render: (v) => (Array.isArray(v) ? v.join(', ') : '-') },
    { key: 'status', label: 'Status', width: '7.25rem' },
    {
      key: 'sentAt',
      label: 'Sent',
      width: '6.25rem',
      render: (v) => (v ? new Date(v).toLocaleDateString() : '-'),
    },
  ];

  return (
    <div className="space-y-3">
      <PageHeader title="Announcements" description="Broadcast messages to the community" />

      <TableCard>
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
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1 sm:w-56 sm:flex-none">
              <ExpandableSearch
                value={searchQuery}
                onChange={(value) => {
                  setSearchQuery(value);
                  setCurrentPage(1);
                }}
                entity="announcements"
              />
            </div>
            <Link to="/announcements/create" className="flex-shrink-0">
              <Button size="md" icon={<FiPlus />} collapseLabel>
                New Announcement
              </Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="py-10 text-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchRows} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <Table
            fixedLayout
            striped
            columns={columns}
            data={rows}
            emptyMessage="No announcements yet"
            showExport={false}
            onRowClick={(row) => navigate(`/announcements/${row.id}`)}
          />
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
      </TableCard>
    </div>
  );
}
