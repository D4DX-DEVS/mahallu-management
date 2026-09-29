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
import Table from '@/components/ui/Table';
import ActionsMenu from '@/components/ui/ActionsMenu';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { errorMessage } from '@/utils/errors';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';
import { TableColumn } from '@/types';
import { toTitleCase } from '@/utils/format';

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
        console.error("Couldn't load assignments:", error);
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
      label: 'Service Type',
      render: (_v, assignment) => (
        <div>
          <div className="font-medium text-foreground">
            {SERVICE_TYPE_OPTIONS.find((x) => x.value === assignment.serviceType)?.label ||
              assignment.serviceType}
          </div>
          <div className="text-xs text-muted-foreground">
            {new Date(assignment.date).toLocaleDateString()}
          </div>
        </div>
      ),
    },
    {
      key: 'description',
      label: 'Description',
      priority: 'secondary',
      render: (_v, assignment) => assignment.description || '—',
    },
    {
      key: 'volunteers',
      label: 'Volunteers',
      priority: 'secondary',
      render: (_v, assignment) => volunteerNames(assignment),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_v, assignment) => <StatusBadge status={assignment.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      sortable: false,
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
    <div className="space-y-4">
      <PageHeader
        title="Volunteer assignments"
        description="Who is doing what, and when."
        breadcrumbs={[{ label: 'Volunteers', path: '/volunteers' }]}
      />
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex-1">
          <div className="flex gap-2 flex-wrap">
            {[{ value: '', label: 'All Status' }, ...ASSIGNMENT_STATUS_OPTIONS].map((status) => (
              <button
                key={status.value}
                onClick={() => {
                  setStatusFilter(status.value);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  statusFilter === status.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={() => navigate('/volunteers/assignments/create')} icon={<FiPlus />} collapseLabel>
          New Assignment
        </Button>
      </div>

      <Table
        columns={columns}
        data={assignments}
        isLoading={loading}
        entity="assignments"
        rowKey={(assignment) => assignment.id}
      />

      {!loading && assignments.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalPages * itemsPerPage}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Delete Assignment"
        message={deleteConfirm ? `Delete assignment from ${deleteConfirm.date}?` : ''}
        consequence="This action cannot be undone."
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
