import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '@/components/ui/Button';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import Tabs from '@/components/ui/Tabs';
import EmptyState from '@/components/ui/EmptyState';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import Badge from '@/components/ui/Badge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import { libraryService, BookIssue } from '@/services/libraryService';
import { toast } from '@/store/toastStore';
import { FiPlus } from 'react-icons/fi';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';
import PageHeader from '@/components/layout/PageHeader';

export default function IssuesList() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [issues, setIssues] = useState<BookIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>(searchParams.get('status') || 'issued');
  const [pagination, setPagination] = useState<any>(null);
  const [confirmReturn, setConfirmReturn] = useState(false);
  const [returnId, setReturnId] = useState<string | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<BookIssue | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  const fetchIssues = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await libraryService.getIssues({
        page: currentPage,
        limit: itemsPerPage,
        status: status || undefined,
      });
      setIssues(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError(loadErrorMessage(err, 'book issues'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, status]);

  useEffect(() => {
    fetchIssues();
  }, [fetchIssues]);

  const handleReturn = async () => {
    if (!returnId) return;
    try {
      await libraryService.returnIssue(returnId);
      setIssues(issues.map((i) => (i.id === returnId ? { ...i, status: 'returned' } : i)));
      toast.success('Book marked as returned');
      setConfirmReturn(false);
      setReturnId(null);
    } catch (error: any) {
      toast.error(errorMessage(error, { action: 'return book' }));
      setConfirmReturn(false);
      setReturnId(null);
    }
  };

  const getStatusBadge = (issue: BookIssue) => {
    const variants = { issued: 'info', returned: 'success', overdue: 'danger' } as const;
    return <Badge variant={variants[issue.status]} className="capitalize">{issue.status}</Badge>;
  };

  const getDaysOverdue = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const days = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return days > 0 ? `${days} days overdue` : 'On time';
  };

  const columns = [
    {
      key: 'bookId',
      label: 'Book',
      sortable: false,
      width: '18rem',
      render: (_: any, issue: BookIssue) => (
        <span className="font-medium text-foreground">
          {typeof issue.bookId === 'object' && issue.bookId ? issue.bookId.title : 'N/A'}
        </span>
      ),
    },
    {
      key: 'memberId',
      label: 'Member',
      sortable: false,
      width: '14rem',
      render: (_: any, issue: BookIssue) =>
        typeof issue.memberId === 'object' && issue.memberId && 'name' in issue.memberId
          ? toTitleCase((issue.memberId as any).name)
          : 'N/A',
    },
    {
      key: 'issueDate',
      label: 'Issued',
      sortable: true,
      priority: 'secondary' as const,
      width: '9rem',
      render: (_: any, issue: BookIssue) => new Date(issue.issueDate).toLocaleDateString(),
    },
    {
      key: 'dueDate',
      label: 'Due',
      sortable: true,
      width: '11rem',
      render: (_: any, issue: BookIssue) => (
        <div>
          <div>{new Date(issue.dueDate).toLocaleDateString()}</div>
          {issue.status !== 'returned' && (
            <div className="text-xs text-muted-foreground">{getDaysOverdue(issue.dueDate)}</div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      width: '8rem',
      render: (_: any, issue: BookIssue) => getStatusBadge(issue),
    },
  ];

  return (
    <>
      <PageHeader
        title="Book issues"
        description="Books on loan, due back and returned."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => navigate('/library/issues/create')}>
            Issue book
          </Button>
        }
      />

      <TableCard>
        <TableToolbar
          tabs={
            <Tabs
              variant="segmented"
              ariaLabel="Issue status"
              value={status || 'all'}
              onChange={(value) => {
                setStatus(value === 'all' ? '' : value);
                setCurrentPage(1);
              }}
              items={[
                { value: 'all', label: 'All' },
                { value: 'issued', label: 'Issued' },
                { value: 'overdue', label: 'Overdue' },
                { value: 'returned', label: 'Returned' },
              ]}
            />
          }
          onRefresh={fetchIssues}
        />

        {error ? (
          <EmptyState variant="error" entity="book issues" description={error} action={{ label: 'Try again', onClick: fetchIssues }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={issues}
              isLoading={loading}
              entity="book issues"
              emptyVariant={status ? 'no-results' : 'empty'}
              emptyAction={
                status
                  ? { label: 'Clear filters', onClick: () => { setStatus(''); setCurrentPage(1); } }
                  : { label: 'Issue book', onClick: () => navigate('/library/issues/create') }
              }
              onRowClick={(issue) => {
                setSelectedIssue(issue);
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
                  entity="book issues"
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
          setSelectedIssue(null);
        }}
        title="Book Issue Details"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowViewModal(false);
                setSelectedIssue(null);
              }}
            >
              Close
            </Button>
            {selectedIssue && selectedIssue.status !== 'returned' && (
              <Button
                onClick={() => {
                  setReturnId(selectedIssue.id);
                  setShowViewModal(false);
                  setConfirmReturn(true);
                }}
              >
                Mark returned
              </Button>
            )}
          </>
        }
      >
        {selectedIssue && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Book</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">
                {typeof selectedIssue.bookId === 'object' && selectedIssue.bookId ? selectedIssue.bookId.title : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Member</p>
              <p className="text-gray-900 dark:text-gray-100">
                {typeof selectedIssue.memberId === 'object' && selectedIssue.memberId && 'name' in selectedIssue.memberId
                  ? toTitleCase((selectedIssue.memberId as any).name)
                  : 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Issued</p>
              <p className="text-gray-900 dark:text-gray-100">
                {new Date(selectedIssue.issueDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Due</p>
              <p className="text-gray-900 dark:text-gray-100">
                {new Date(selectedIssue.dueDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
              <p className="text-gray-900 dark:text-gray-100 capitalize">{selectedIssue.status}</p>
            </div>
            {selectedIssue.returnDate && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Returned</p>
                <p className="text-gray-900 dark:text-gray-100">
                  {new Date(selectedIssue.returnDate).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isLoading={loading}
        isOpen={confirmReturn}
        title="Mark this book as returned?"
        message="The copy goes back on the shelf and counts as available again."
        confirmLabel="Mark returned"
        variant="primary"
        cancelLabel="Cancel"
        onConfirm={handleReturn}
        onCancel={() => {
          setConfirmReturn(false);
          setReturnId(null);
        }}
      />
    </>
  );
}
