import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import Badge from '@/components/ui/Badge';
import { PageSkeleton } from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { libraryService, BookIssue } from '@/services/libraryService';
import { toast } from '@/store/toastStore';
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
      toast.error(error.response?.data?.message || 'Failed to return book');
      setConfirmReturn(false);
      setReturnId(null);
    }
  };

  const getStatusBadge = (issue: BookIssue) => {
    const colors = {
      issued: 'blue',
      returned: 'green',
      overdue: 'red',
    };
    return <Badge color={colors[issue.status]}>{issue.status}</Badge>;
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
      render: (_: any, issue: BookIssue) => (
        <div className="text-sm">
          {typeof issue.bookId === 'object' ? issue.bookId.title : 'N/A'}
        </div>
      ),
    },
    {
      key: 'memberId',
      label: 'Member',
      render: (_: any, issue: BookIssue) => (
        <div className="text-sm">
          {typeof issue.memberId === 'object' && issue.memberId && 'name' in issue.memberId ? (issue.memberId as any).name : 'N/A'}
        </div>
      ),
    },
    {
      key: 'issueDate',
      label: 'Issued',
      render: (_: any, issue: BookIssue) => new Date(issue.issueDate).toLocaleDateString(),
    },
    {
      key: 'dueDate',
      label: 'Due',
      render: (_: any, issue: BookIssue) => (
        <div>
          <div className="text-sm">{new Date(issue.dueDate).toLocaleDateString()}</div>
          {issue.status !== 'returned' && (
            <div className="text-xs text-gray-500">{getDaysOverdue(issue.dueDate)}</div>
          )}
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_: any, issue: BookIssue) => getStatusBadge(issue),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, issue: BookIssue) => (
        issue.status !== 'returned' && (
          <Button
            size="sm"
            onClick={() => {
              setReturnId(issue.id);
              setConfirmReturn(true);
            }}
          >
            <FiCheckCircle className="h-4 w-4 mr-1" />
            Return
          </Button>
        )
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold">Book Issues</h1>
        <Button onClick={() => navigate('/library/issues/create')}>
          <FiPlus className="h-4 w-4 mr-2" />
          Issue Book
        </Button>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'issued', 'overdue', 'returned'].map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatus(s === 'all' ? '' : s);
              setCurrentPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              (s === 'all' ? status === '' : status === s)
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Issues Table */}
      {loading ? (
        <PageSkeleton variant="section" />
      ) : (
        <>
          <Table columns={columns} data={issues} />
          {pagination && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          )}
        </>
      )}

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
