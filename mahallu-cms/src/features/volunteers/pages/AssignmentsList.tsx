import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { volunteerService, type VolunteerAssignment, SERVICE_TYPE_OPTIONS, ASSIGNMENT_STATUS_OPTIONS } from '@/services/volunteerService';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import Segmented from '@/components/ui/Segmented';
import StatusBadge from '@/components/ui/StatusBadge';
import Table from '@/components/ui/Table';
import RowActions from '@/components/ui/RowActions';
import { AvatarStack } from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { TableColumn } from '@/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

export default function AssignmentsList() {
  const navigate = useNavigate();
  const [assignments, setAssignments] = useState<VolunteerAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [totalPages, setTotalPages] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; date: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        setLoading(true);
        const result = await volunteerService.getAssignments({
          page: currentPage,
          limit: itemsPerPage,
          status: statusFilter || undefined,
        });
        setAssignments(result.data);
        setTotalPages(result.pagination?.totalPages || 1);
      } catch (error) {
        console.error('Failed to fetch assignments:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAssignments();
  }, [currentPage, itemsPerPage, statusFilter]);

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
      toast.error(getFriendlyError(error, "Couldn't delete assignment. Try again in a moment."));
    } finally {
      setIsDeleting(false);
    }
  }, [deleteConfirm]);

  const handleCancelDelete = useCallback(() => {
    setDeleteConfirm(null);
  }, []);

  const volunteerNames = (assignment: VolunteerAssignment) => {
    if (!Array.isArray(assignment.volunteerIds)) return '-';
    return assignment.volunteerIds
      .map((v) => (typeof v === 'object' ? v.name : '-'))
      .join(', ');
  };

  const columns: TableColumn<VolunteerAssignment>[] = [
    { key: 'date', label: 'Date', render: (_, a) => new Date(a.date).toLocaleDateString() },
    {
      key: 'serviceType',
      label: 'Service Type',
      render: (_, a) => (
        <div>
          <div className="font-semibold">
            {SERVICE_TYPE_OPTIONS.find((x) => x.value === a.serviceType)?.label || a.serviceType}
          </div>
          <div className="text-xs text-[#7B8983] dark:text-surface-muted">{a.description}</div>
        </div>
      ),
    },
    {
      key: 'volunteerIds',
      label: 'Volunteers',
      render: (_, a) =>
        Array.isArray(a.volunteerIds) && a.volunteerIds.length > 0 ? (
          <div className="flex items-center gap-2">
            <AvatarStack
              items={a.volunteerIds.map((v) => ({ name: typeof v === 'object' ? v.name : '' }))}
              max={3}
            />
            <span className="text-xs">{volunteerNames(a)}</span>
          </div>
        ) : (
          '-'
        ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, a) => <StatusBadge status={a.status} tone={a.status === 'assigned' ? 'info' : undefined} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, a) => (
        <RowActions
          onEdit={() => navigate(`/volunteers/assignments/${a.id}/edit`)}
          onDelete={() => handleDeleteClick(a.id, new Date(a.date).toLocaleDateString())}
          ariaLabels={{ edit: 'Edit assignment', delete: 'Delete assignment' }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Assignments"
        description="Volunteer duty assignments and their status"
        actions={<Button onClick={() => navigate('/volunteers/assignments/create')}>+ New assignment</Button>}
      />

      <Card padding="none" className="overflow-visible">
        <FilterBar>
          <Segmented
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setCurrentPage(1);
            }}
            options={[{ value: '', label: 'All Status' }, ...ASSIGNMENT_STATUS_OPTIONS]}
          />
        </FilterBar>

        <div className="p-3.5">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : assignments.length === 0 ? (
            <EmptyState title="No assignments found" description="Create an assignment to schedule volunteers." />
          ) : (
            <>
              <Table columns={columns} data={assignments} showExport={false} />

              <div className="mt-3.5">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalPages * itemsPerPage}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                />
              </div>
            </>
          )}
        </div>
      </Card>

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Delete assignment?"
        message={deleteConfirm ? `Delete assignment from ${deleteConfirm.date}?` : ''}
        consequence="This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isLoading={isDeleting}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}
