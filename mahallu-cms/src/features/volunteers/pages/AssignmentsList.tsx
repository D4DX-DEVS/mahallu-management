import { useEffect, useState, useCallback } from 'react';
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import {
  volunteerService,
  type VolunteerAssignment,
  SERVICE_TYPE_OPTIONS,
  ASSIGNMENT_STATUS_OPTIONS,
} from '@/services/volunteerService';
import Button from '@/components/ui/Button';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import Tabs from '@/components/ui/Tabs';
import EmptyState from '@/components/ui/EmptyState';
import Table from '@/components/ui/Table';
import ActionsMenu from '@/components/ui/ActionsMenu';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';
import { TableColumn } from '@/types';
import { toTitleCase } from '@/utils/format';

export default function AssignmentsList() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<VolunteerAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [totalPages, setTotalPages] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; date: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<VolunteerAssignment | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await volunteerService.getAssignments({
        page: currentPage,
        limit: itemsPerPage,
        status: statusFilter || undefined,
      });
      setAssignments(result.data);
      setTotalPages(result.pagination?.totalPages || 1);
      setTotalItems(result.pagination?.total ?? result.data.length);
    } catch (err) {
      setError(loadErrorMessage(err, 'assignments'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, statusFilter]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  const handleDeleteClick = useCallback((id: string, date: string) => {
    setDeleteConfirm({ id, date });
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirm) return;

    setIsDeleting(true);
    try {
      await volunteerService.deleteAssignment(deleteConfirm.id);
      setAssignments((prev) => prev.filter((a) => a.id !== deleteConfirm.id));
      toast.success('Assignment deleted');
      setDeleteConfirm(null);
    } catch (error) {
      const message = errorMessage(error, { action: 'delete this assignment' });
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  }, [deleteConfirm]);

  const handleCancelDelete = useCallback(() => {
    setDeleteConfirm(null);
  }, []);

  const volunteerNames = (assignment: VolunteerAssignment) => {
    if (!Array.isArray(assignment.volunteerIds)) return '-';
    return assignment.volunteerIds.map((v) => (typeof v === 'object' ? toTitleCase(v.name) : '-')).join(', ');
  };

  const columns: TableColumn<VolunteerAssignment>[] = [
    {
      key: 'serviceType',
      label: 'Service type',
      sortable: true,
      width: '16rem',
      render: (_v, assignment) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">
            {SERVICE_TYPE_OPTIONS.find((x) => x.value === assignment.serviceType)?.label ||
              assignment.serviceType}
          </div>
          <div className="text-xs text-muted-foreground">
            {new Date(assignment.date).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    { key: 'description', label: 'Description', sortable: false, priority: 'secondary', width: '18rem', render: (_v, assignment) => assignment.description || '—' },
    { key: 'volunteers', label: 'Volunteers', sortable: false, priority: 'secondary', width: '16rem', render: (_v, assignment) => volunteerNames(assignment) },
    { key: 'status', label: 'Status', sortable: true, width: '8rem', render: (_v, assignment) => <StatusBadge status={assignment.status} /> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      sortable: false,
      width: '6.5rem',
      render: (_v, assignment) => (
        <ActionsMenu
          label="Actions for this assignment"
          items={[
            {
              label: 'Edit',
              icon: <FiEdit2 className="h-4 w-4" />,
              onClick: () => navigate(`/volunteers/assignments/${assignment.id}/edit`),
            },
            {
              label: 'Delete',
              icon: <FiTrash2 className="h-4 w-4" />,
              onClick: () =>
                handleDeleteClick(assignment.id, new Date(assignment.date).toLocaleDateString()),
              variant: 'danger' as const,
            },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Volunteer assignments"
        description="Who is doing what, and when."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => navigate('/volunteers/assignments/create')}>
            New assignment
          </Button>
        }
      />

      <TableCard>
        <TableToolbar
          tabs={
            <Tabs
              variant="segmented"
              ariaLabel="Assignment status"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}
              items={[{ value: '', label: 'All' }, ...ASSIGNMENT_STATUS_OPTIONS]}
            />
          }
          onRefresh={fetchAssignments}
        />

        {error ? (
          <EmptyState variant="error" entity="assignments" description={error} action={{ label: 'Try again', onClick: fetchAssignments }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={assignments}
              isLoading={loading}
              entity="assignments"
              emptyVariant={statusFilter ? 'no-results' : 'empty'}
              emptyAction={
                statusFilter
                  ? { label: 'Clear filters', onClick: () => { setStatusFilter(''); setCurrentPage(1); } }
                  : { label: 'Add assignment', onClick: () => navigate('/volunteers/assignments/create') }
              }
              rowKey={(assignment) => assignment.id}
              onRowClick={(assignment) => {
                setSelectedAssignment(assignment);
                setShowViewModal(true);
              }}
            />

            <div className="mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                entity="assignments"
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(size) => {
                  setItemsPerPage(size);
                  setCurrentPage(1);
                }}
              />
            </div>
          </>
        )}
      </TableCard>

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedAssignment(null);
        }}
        title="Assignment Details"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowViewModal(false);
                setSelectedAssignment(null);
              }}
            >
              Close
            </Button>
            {selectedAssignment && (
              <Button
                variant="outline"
                onClick={() => navigate(`/volunteers/assignments/${selectedAssignment.id}/edit`)}
              >
                Edit
              </Button>
            )}
            {selectedAssignment && (
              <Button
                variant="danger"
                onClick={() => {
                  setShowViewModal(false);
                  handleDeleteClick(selectedAssignment.id, new Date(selectedAssignment.date).toLocaleDateString());
                }}
              >
                Delete
              </Button>
            )}
          </>
        }
      >
        {selectedAssignment && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Date</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">
                {new Date(selectedAssignment.date).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Service Type</p>
              <p className="text-gray-900 dark:text-gray-100">
                {SERVICE_TYPE_OPTIONS.find((x) => x.value === selectedAssignment.serviceType)?.label ||
                  selectedAssignment.serviceType}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Volunteers</p>
              <p className="text-gray-900 dark:text-gray-100">{volunteerNames(selectedAssignment)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
              <p className="text-gray-900 dark:text-gray-100">
                <StatusBadge status={selectedAssignment.status} />
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Description</p>
              <p className="text-gray-900 dark:text-gray-100">{selectedAssignment.description || '—'}</p>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title={deleteConfirm ? `Delete the assignment from ${deleteConfirm.date}?` : 'Delete this assignment?'}
        message="This permanently removes the assignment and cannot be undone."
        confirmLabel="Delete assignment"
        cancelLabel="Cancel"
        isLoading={isDeleting}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </>
  );
}
