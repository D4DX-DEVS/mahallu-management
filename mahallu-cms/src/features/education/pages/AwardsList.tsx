import { useState, useEffect, useCallback } from 'react';
import { FiTrash2 } from 'react-icons/fi';
import { useNavigate, useParams } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import FilterPanel from '@/components/ui/FilterPanel';
import Select from '@/components/ui/Select';
import EmptyState from '@/components/ui/EmptyState';
import StatusBadge from '@/components/ui/StatusBadge';
import Table from '@/components/ui/Table';
import ActionsMenu from '@/components/ui/ActionsMenu';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import { toast } from '@/store/toastStore';
import {
  scholarshipService,
  ScholarshipAward,
  AWARD_STATUS_OPTIONS,
  awardStatusLabel,
  memberName,
} from '@/services/scholarshipService';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import { TableColumn } from '@/types';

export default function AwardsList() {
  const navigate = useNavigate();
  const { scholarshipId } = useParams<{ scholarshipId: string }>();
  const [awards, setAwards] = useState<ScholarshipAward[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [status, setStatus] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scholarship, setScholarship] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedAward, setSelectedAward] = useState<ScholarshipAward | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  const columns: TableColumn<ScholarshipAward>[] = [
    {
      key: 'student',
      label: 'Student',
      sortable: false,
      width: '16rem',
      render: (_v, award) => <span className="font-medium text-foreground">{toTitleCase(memberName(award.memberId))}</span>,
    },
    {
      key: 'awardedDate',
      label: 'Awarded date',
      sortable: true,
      priority: 'secondary',
      width: '10rem',
      render: (_v, award) => new Date(award.awardedDate).toLocaleDateString(),
    },
    {
      key: 'amount',
      label: 'Amount',
      priority: 'secondary',
      align: 'right',
      sortable: true,
      width: '9rem',
      render: (_v, award) => <span className="tabular-nums">₹{Number(award.amount ?? 0).toLocaleString('en-IN')}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      width: '8rem',
      render: (_v, award) => <StatusBadge status={award.status} label={awardStatusLabel(award.status)} />,
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      sortable: false,
      width: '6.5rem',
      render: (_v, award) => (
        <ActionsMenu
          label={'Actions for ' + toTitleCase(memberName(award.memberId))}
          items={[
            {
              label: 'Delete',
              icon: <FiTrash2 className="h-4 w-4" />,
              onClick: () => setDeleteConfirm({ id: award.id, name: memberName(award.memberId) }),
              variant: 'danger' as const,
            },
          ]}
        />
      ),
    },
  ];

  const fetchAwards = useCallback(async () => {
    if (!scholarshipId) return;
    setLoading(true);
    setError(null);
    try {
      const [awardsData, scholData] = await Promise.all([
        scholarshipService.getAwardsByScholarship(scholarshipId, {
          page: currentPage,
          limit: itemsPerPage,
          status: status || undefined,
        }),
        scholarshipService.getScholarship(scholarshipId),
      ]);
      setAwards(awardsData.data);
      setPagination(awardsData.pagination);
      setScholarship(scholData);
    } catch (err) {
      setError(loadErrorMessage(err, 'awards'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, status, scholarshipId]);

  useEffect(() => {
    setCurrentPage(1);
  }, [status]);

  useEffect(() => {
    fetchAwards();
  }, [fetchAwards]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setDeleting(true);
      await scholarshipService.deleteAward(deleteConfirm.id);
      setDeleteConfirm(null);
      toast.success(`Award for ${toTitleCase(deleteConfirm.name)} deleted`);
      await fetchAwards();
    } catch (error: any) {
      toast.error(errorMessage(error, { action: 'delete award' }));
    } finally {
      setDeleting(false);
    }
  };

  const description = scholarship
    ? [
        toTitleCase(scholarship.name) + (scholarship.nameMl ? ` (${scholarship.nameMl})` : ''),
        scholarship.academicYear,
        scholarship.criteria,
      ]
        .filter(Boolean)
        .join(' · ')
    : 'Awards granted under this scholarship.';

  return (
    <>
      <PageHeader
        title="Scholarship awards"
        description={description}
        actions={
          <Button
            icon={<FiPlus />}
            collapseLabel
            onClick={() => navigate(`/education/scholarships/${scholarshipId}/awards/create`)}
          >
            New award
          </Button>
        }
      />

      <TableCard>
        <TableToolbar
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={status ? 1 : 0}
          onRefresh={fetchAwards}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-52">
              <Select
                label="Status"
                options={[{ value: '', label: 'All statuses' }, ...AWARD_STATUS_OPTIONS]}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              />
            </div>
            {status && (
              <Button variant="ghost" onClick={() => setStatus('')}>
                Clear filters
              </Button>
            )}
          </FilterPanel>
        )}

        {error ? (
          <EmptyState variant="error" entity="awards" description={error} action={{ label: 'Try again', onClick: fetchAwards }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={awards}
              isLoading={loading}
              entity="awards"
              emptyVariant={status ? 'no-results' : 'empty'}
              emptyAction={
                status
                  ? { label: 'Clear filters', onClick: () => setStatus('') }
                  : {
                      label: 'Add award',
                      onClick: () => navigate(`/education/scholarships/${scholarshipId}/awards/create`),
                    }
              }
              rowKey={(award) => award.id}
              onRowClick={(award) => {
                setSelectedAward(award);
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
                  entity="awards"
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
          setSelectedAward(null);
        }}
        title="Award Details"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowViewModal(false);
                setSelectedAward(null);
              }}
            >
              Close
            </Button>
            {selectedAward && (
              <Button
                variant="danger"
                onClick={() => {
                  setShowViewModal(false);
                  setDeleteConfirm({ id: selectedAward.id, name: memberName(selectedAward.memberId) });
                }}
              >
                Delete
              </Button>
            )}
          </>
        }
      >
        {selectedAward && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Student</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">
                {toTitleCase(memberName(selectedAward.memberId))}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Awarded Date</p>
              <p className="text-gray-900 dark:text-gray-100">
                {new Date(selectedAward.awardedDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Amount</p>
              <p className="text-gray-900 dark:text-gray-100">₹{selectedAward.amount}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
              <p className="text-gray-900 dark:text-gray-100">{awardStatusLabel(selectedAward.status)}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Remarks</p>
              <p className="text-gray-900 dark:text-gray-100">{selectedAward.remarks || '—'}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
              <p className="text-gray-900 dark:text-gray-100">
                {new Date(selectedAward.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title={deleteConfirm ? `Delete the award for ${toTitleCase(deleteConfirm.name)}?` : 'Delete this award?'}
        message="This permanently removes the award and cannot be undone."
        isLoading={deleting}
        variant="danger"
        confirmLabel="Delete award"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </>
  );
}
