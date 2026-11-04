import { useState, useEffect } from 'react';
import { FiPlus } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import Tabs from '@/components/ui/Tabs';
import StatusBadge from '@/components/ui/StatusBadge';
import TableToolbar from '@/components/ui/TableToolbar';
import Pagination from '@/components/ui/Pagination';
import { Pagination as PaginationType, TableColumn } from '@/types';
import { announcementService, Announcement } from '@/services/announcementService';
import { useDebounce } from '@/hooks/useDebounce';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

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
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchRows();
  }, [statusFilter, debouncedSearch, currentPage, itemsPerPage]);

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = { page: currentPage, limit: itemsPerPage };
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
    { key: 'title', label: 'Title', sortable: true, width: '18rem', render: (v) => <span className="font-medium text-foreground">{v}</span> },
    { key: 'category', label: 'Category', sortable: true, priority: 'secondary', width: '10rem', render: (v) => (v ? toTitleCase(v) : '—') },
    { key: 'audience', label: 'Audience', sortable: true, priority: 'secondary', width: '9rem', render: (v) => (v ? toTitleCase(v) : '—') },
    { key: 'channels', label: 'Channels', sortable: false, priority: 'tertiary', width: '10rem', render: (v) => (Array.isArray(v) ? v.join(', ') : '—') },
    { key: 'status', label: 'Status', sortable: true, width: '8rem', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'sentAt',
      label: 'Sent',
      sortable: true,
      width: '9rem',
      render: (v) => (v ? new Date(v).toLocaleDateString() : '—'),
    },
  ];

  const isFiltered = Boolean(statusFilter || debouncedSearch);

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Broadcast messages to the community."
        actions={
          <Link to="/announcements/create">
            <Button icon={<FiPlus />} collapseLabel>
              New announcement
            </Button>
          </Link>
        }
      />

      <TableCard>
        <TableToolbar
          tabs={
            <Tabs
              variant="segmented"
              ariaLabel="Announcement status"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}
              items={STATUS_TABS}
            />
          }
          searchQuery={searchQuery}
          onSearchChange={(value) => {
            setSearchQuery(value);
            setCurrentPage(1);
          }}
          searchEntity="announcements"
          onRefresh={fetchRows}
        />

        {error ? (
          <EmptyState variant="error" entity="announcements" description={error} action={{ label: 'Try again', onClick: fetchRows }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={rows}
              isLoading={loading}
              entity="announcements"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? {
                      label: 'Clear filters',
                      onClick: () => {
                        setSearchQuery('');
                        setStatusFilter('');
                        setCurrentPage(1);
                      },
                    }
                  : { label: 'Add announcement', onClick: () => navigate('/announcements/create') }
              }
              onRowClick={(row) => navigate(`/announcements/${row.id}`)}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="announcements"
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
    </>
  );
}
