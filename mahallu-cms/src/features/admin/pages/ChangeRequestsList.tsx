import { useState, useEffect } from 'react';
import { FiCheckCircle, FiXCircle } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import Modal from '@/components/ui/Modal';
import { toast } from '@/store/toastStore';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { registrationService, ChangeRequest } from '@/services/registrationService';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate, toTitleCase } from '@/utils/format';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';

export default function ChangeRequestsList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [reviewModal, setReviewModal] = useState<{
    open: boolean;
    id?: string;
    action?: 'approved' | 'rejected';
  }>({
    open: false,
  });
  const [remarks, setRemarks] = useState('');
  const [reviewing, setReviewing] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchChangeRequests();
  }, [debouncedSearch, statusFilter, currentPage]);

  const fetchChangeRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
      };
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      const result = await registrationService.getChangeRequests(params);
      setChangeRequests(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(loadErrorMessage(err, 'change requests'));
    } finally {
      setLoading(false);
    }
  };

  const handleReviewClick = (id: string, action: 'approved' | 'rejected') => {
    setReviewModal({ open: true, id, action });
    setRemarks('');
  };

  const handleReview = async () => {
    if (!reviewModal.id || !reviewModal.action) return;
    if (reviewModal.action === 'rejected' && !remarks.trim()) {
      toast.error('Please enter a reason for rejecting this.');
      return;
    }

    try {
      setReviewing(true);
      await registrationService.reviewChangeRequest(reviewModal.id, reviewModal.action, remarks || undefined);
      toast.success(`Change request ${reviewModal.action}`);
      setReviewModal({ open: false });
      await fetchChangeRequests();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'review change request' }));
    } finally {
      setReviewing(false);
    }
  };

  const columns: TableColumn[] = [
    { key: 'requester', label: 'Requested By' },
    { key: 'targetType', label: 'Type' },
    { key: 'changes', label: 'Changes' },
    { key: 'status', label: 'Status' },
    { key: 'createdAt', label: 'Date' },
    { key: 'actions', label: 'Actions' },
  ];

  const rows = changeRequests.map((req) => ({
    requester:
      typeof req.requestedByMemberId === 'object'
        ? toTitleCase(req.requestedByMemberId.name)
        : 'Unknown',
    targetType: req.targetType || '-',
    changes: (
      <div className="text-xs space-y-1 max-w-xs">
        {(req.changes ?? []).slice(0, 2).map((change, idx) => (
          <div key={idx} className="text-gray-600 dark:text-gray-400">
            <span className="font-medium">{change.field}:</span> {String(change.oldValue)} →{' '}
            {String(change.newValue)}
          </div>
        ))}
        {(req.changes ?? []).length > 2 && (
          <div className="text-gray-500 dark:text-gray-500">+{(req.changes ?? []).length - 2} more changes</div>
        )}
      </div>
    ),
    status: <StatusBadge status={req.status} />,
    createdAt: formatDate(req.createdAt),
    actions:
      req.status === 'pending' ? (
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleReviewClick(req.id || req._id || '', 'approved')}
            className="text-green-600 dark:text-green-400"
            title="Approve"
          >
            <FiCheckCircle className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleReviewClick(req.id || req._id || '', 'rejected')}
            className="text-red-600 dark:text-red-400"
            title="Reject"
          >
            <FiXCircle className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <span className="text-sm text-gray-500 dark:text-gray-400">-</span>
      ),
  }));

  return (
    <div className="space-y-4">
      <PageHeader description="Review and manage pending member change requests" title="Change Requests" />

      <div className="flex items-center justify-between"></div>

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
        />

        {isFilterVisible && (
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
                { value: 'all', label: 'All Status' },
              ]}
            />
          </div>
        )}

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <EmptyState
            variant="error"
            entity="change requests"
            description={error}
            action={{ label: 'Retry', onClick: fetchChangeRequests }}
          />
        ) : changeRequests.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 dark:text-gray-400">No change requests found</p>
          </div>
        ) : (
          <>
            <Table fixedLayout striped columns={columns} data={rows} />
            {pagination && (
              <Pagination
                currentPage={currentPage}
                totalPages={pagination.totalPages || Math.ceil(pagination.total / itemsPerPage)}
                totalItems={pagination.total}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            )}
          </>
        )}
      </TableCard>

      {/* Review Modal */}
      <Modal
        isOpen={reviewModal.open}
        onClose={() => setReviewModal({ open: false })}
        title={`${reviewModal.action === 'approved' ? 'Approve' : 'Reject'} Change Request`}
      >
        <div className="space-y-4">
          {reviewModal.action === 'rejected' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Remarks
              </label>
              <textarea
                aria-label="Remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                rows={4}
                placeholder="Enter rejection remarks..."
              />
            </div>
          )}
          {reviewModal.action === 'approved' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Remarks (Optional)
              </label>
              <textarea
                aria-label="Remarks (Optional)"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                rows={4}
                placeholder="Enter approval remarks..."
              />
            </div>
          )}
          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-3">
            <Button variant="outline" onClick={() => setReviewModal({ open: false })} disabled={reviewing}>
              Cancel
            </Button>
            <Button
              onClick={handleReview}
              isLoading={reviewing}
              className={
                reviewModal.action === 'approved'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }
            >
              {reviewModal.action === 'approved' ? 'Approve' : 'Reject'} Request
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
