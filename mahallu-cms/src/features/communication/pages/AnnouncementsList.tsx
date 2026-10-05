import { useState, useEffect } from 'react';
import { FiPlus } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import ExpandableSearch from '@/components/ui/ExpandableSearch';
import ActionBar from '@/components/ui/ActionBar';
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
        <ActionBar
          leading={
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
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          }
        >
          <ExpandableSearch
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value);
              setCurrentPage(1);
            }}
            entity="announcements"
          />
          <Link to="/announcements/create" className="flex-shrink-0">
            <Button size="md" icon={<FiPlus />} collapseLabel>
              New Announcement
            </Button>
          </Link>
        </ActionBar>

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <EmptyState
            variant="error"
            entity="announcements"
            description={error}
            action={{ label: 'Retry', onClick: fetchRows }}
          />
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
