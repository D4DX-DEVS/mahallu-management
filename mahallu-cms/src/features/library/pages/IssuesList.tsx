import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import Pagination from '@/components/ui/Pagination';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import Segmented from '@/components/ui/Segmented';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { TableColumn } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { libraryService, BookIssue } from '@/services/libraryService';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { FiPlus, FiCheckCircle } from 'react-icons/fi';

export default function IssuesList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [issues, setIssues] = useState<BookIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [status, setStatus] = useState<string>(searchParams.get('status') || 'issued');
  const [pagination, setPagination] = useState<any>(null);
  const [confirmReturn, setConfirmReturn] = useState(false);
  const [returnId, setReturnId] = useState<string | null>(null);

  // Fetch issues
  useEffect(() => {
    const fetchIssues = async () => {
      try {
        setLoading(true);
        const result = await libraryService.getIssues({
          page: currentPage,
          limit: itemsPerPage,
          status: status || undefined,
        });
        setIssues(result.data);
        setPagination(result.pagination);
      } catch (error) {
        console.error('Failed to fetch issues:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchIssues();
  }, [currentPage, status]);

  const handleReturn = async () => {
    if (!returnId) return;
    try {
      await libraryService.returnIssue(returnId);
      setIssues(issues.map((i) => (i.id === returnId ? { ...i, status: 'returned' } : i)));
      toast.success('Book marked as returned');
      setConfirmReturn(false);
      setReturnId(null);
    } catch (error: any) {
      toast.error(getFriendlyError(error, "Couldn't return book. Try again in a moment."));
      setConfirmReturn(false);
      setReturnId(null);
    }
  };

  const getDaysOverdue = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const days = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return days > 0 ? `${days} days overdue` : 'On time';
  };

  const columns: TableColumn<BookIssue>[] = [
    {
      key: 'bookId',
      label: 'Book',
      render: (_, issue) => (
        typeof issue.bookId === 'object' && issue.bookId?.title ? <PersonCell name={issue.bookId.title} /> : 'N/A'
      ),
    },
    {
      key: 'memberId',
      label: 'Member',
      render: (_, issue) =>
        typeof issue.memberId === 'object' && issue.memberId && 'name' in issue.memberId ? (
          <PersonCell name={(issue.memberId as any).name} size={32} />
        ) : (
          'N/A'
        ),
    },
    {
      key: 'issueDate',
      label: 'Issued',
      render: (_, issue) => new Date(issue.issueDate).toLocaleDateString(),
    },
    {
      key: 'dueDate',
      label: 'Due',
      render: (_, issue) => (
        <div>
          <div>{new Date(issue.dueDate).toLocaleDateString()}</div>
          {issue.status !== 'returned' && (
            <div className="text-xs text-[#7B8983] dark:text-surface-muted">{getDaysOverdue(issue.dueDate)}</div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, issue) => <StatusBadge status={issue.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, issue) =>
        issue.status !== 'returned' ? (
          <RowActions
            extra={[
              {
                label: 'Return book',
                icon: <FiCheckCircle />,
                onClick: () => {
                  setReturnId(issue.id);
                  setConfirmReturn(true);
                },
              },
            ]}
          />
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Book issues"
        description="Books issued to members and their return status"
        actions={
          <Button onClick={() => navigate('/library/issues/create')}>
            <FiPlus className="h-3.5 w-3.5" />
            Issue book
          </Button>
        }
      />

      <Card padding="none" className="overflow-visible">
        <FilterBar>
          <Segmented
            aria-label="Filter by status"
            value={status === '' ? 'all' : status}
            onChange={(s) => {
              setStatus(s === 'all' ? '' : s);
              setCurrentPage(1);
            }}
            options={['all', 'issued', 'overdue', 'returned'].map((s) => ({
              value: s,
              label: s.charAt(0).toUpperCase() + s.slice(1),
            }))}
          />
        </FilterBar>

        {/* Issues Table */}
        <div className="p-3.5">
          {loading ? (
            <LoadingSpinner />
          ) : (
            <>
              {issues.length === 0 ? (
                <EmptyState title="No book issues found" description="Issued books will show up here." />
              ) : (
                <Table columns={columns} data={issues} showExport={false} />
              )}
              {pagination && (
                <div className="mt-3.5">
                  <Pagination
                    currentPage={pagination.page}
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

      <ConfirmDialog
        isOpen={confirmReturn}
        title="Return Book"
        message="Mark this book as returned?"
        confirmLabel="Return"
        cancelLabel="Cancel"
        onConfirm={handleReturn}
        onCancel={() => {
          setConfirmReturn(false);
          setReturnId(null);
        }}
      />
    </div>
  );
}
