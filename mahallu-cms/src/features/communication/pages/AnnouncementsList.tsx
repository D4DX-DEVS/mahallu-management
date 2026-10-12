import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import Segmented from '@/components/ui/Segmented';
import StatusBadge from '@/components/ui/StatusBadge';
import RowActions from '@/components/ui/RowActions';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import { Pagination as PaginationType, TableColumn } from '@/types';
import { announcementService, Announcement } from '@/services/announcementService';
import { useDebounce } from '@/hooks/useDebounce';
import { useUndoableAction } from '@/hooks/useUndoableAction';
import { getFriendlyError } from '@/utils/apiMessages';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'sent', label: 'Sent' },
];

export default function AnnouncementsList() {
  const undo = useUndoableAction('announcement');
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
      setError(getFriendlyError(err, "Couldn't load announcements. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  const columns: TableColumn<Announcement>[] = [
    { key: 'title', label: 'Title' },
    { key: 'category', label: 'Category', render: (v) => (v ? <StatusBadge status={String(v)} tone="neutral" dot={false} /> : '-') },
    { key: 'audience', label: 'Audience', render: (v) => (v ? <StatusBadge status={String(v)} tone="neutral" dot={false} /> : '-') },
    { key: 'channels', label: 'Channels', render: (v) => (Array.isArray(v) ? v.join(', ') : '-') },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v === 'sent' ? 'completed' : v} label={v ? String(v).charAt(0).toUpperCase() + String(v).slice(1) : undefined} /> },
    {
      key: 'sentAt',
      label: 'Sent',
      render: (v) => (v ? new Date(v).toLocaleDateString() : '-'),
    },
    {
      key: 'actions',
      label: 'Actions',
      hideable: false,
      render: (_v, row) => (
        <RowActions
          onView={() => navigate(`/announcements/${row.id}`)}
          ariaLabels={{ view: 'View announcement' }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Announcements"
        description="Broadcast messages to the community"
        actions={
          <Link to="/announcements/create">
            <Button>+ New announcement</Button>
          </Link>
        }
      />

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{
            value: searchQuery,
            onChange: (v) => {
              setSearchQuery(v);
              setCurrentPage(1);
            },
            placeholder: 'Search announcements',
          }}
        >
          <Segmented
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setCurrentPage(1);
            }}
            options={STATUS_TABS}
          />
        </FilterBar>

        <div className="p-3.5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <Button onClick={fetchRows} className="mt-4" variant="outline">
                Retry
              </Button>
            </div>
          ) : (
            <Table
              columns={columns}
              data={undo.filterHidden(rows, (r) => r.id)}
              emptyMessage="No announcements yet"
              showExport={false}
              onRowClick={(row) => navigate(`/announcements/${row.id}`)}
            />
          )}

          {pagination && (
            <div className="mt-3.5">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                itemsPerPage={pagination.limit}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
