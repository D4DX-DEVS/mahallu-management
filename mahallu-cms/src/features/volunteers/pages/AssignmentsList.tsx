import { useEffect, useState, useCallback } from 'react';
import { FiPlus } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import {
  volunteerService,
  type VolunteerAssignment,
  SERVICE_TYPE_OPTIONS,
  ASSIGNMENT_STATUS_OPTIONS,
} from '@/services/volunteerService';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import { toast } from '@/store/toastStore';
import { errorMessage } from '@/utils/errors';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';
import SortableTh from '@/components/ui/SortableTh';
import { useSortableRows } from '@/hooks/useSortableRows';
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
  const [selectedAssignment, setSelectedAssignment] = useState<VolunteerAssignment | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

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

  /* Service type and Volunteers both render resolved labels, so each sorts on
     the text in the cell rather than on the code or the id list behind it. */
  const {
    rows: sortedAssignments,
    sort,
    toggleSort,
  } = useSortableRows(assignments, null, {
    serviceType: (row) =>
      SERVICE_TYPE_OPTIONS.find((x) => x.value === row.serviceType)?.label || row.serviceType,
    volunteers: (row) => volunteerNames(row),
  });

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

      {loading ? (
        <Card>
          <div className="py-8 text-center">Loading assignments...</div>
        </Card>
      ) : assignments.length === 0 ? (
        <Card>
          <div className="py-8 text-center text-gray-500">
            <p>No assignments found</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <SortableTh sortKey="date" sort={sort} onSort={toggleSort}>
                    Date
                  </SortableTh>
                  <SortableTh sortKey="serviceType" sort={sort} onSort={toggleSort}>
                    Service Type
                  </SortableTh>
                  <SortableTh
                    sortKey="volunteers"
                    sort={sort}
                    onSort={toggleSort}
                    responsiveClassName="hidden sm:table-cell"
                  >
                    Volunteers
                  </SortableTh>
                  <SortableTh sortKey="status" sort={sort} onSort={toggleSort}>
                    Status
                  </SortableTh>
                  <th className="px-4 py-3 text-right text-label font-semibold text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedAssignments.map((assignment) => (
                  <tr
                    key={assignment.id}
                    className="border-b hover:bg-gray-50 cursor-pointer"
                    onClick={() => {
                      setSelectedAssignment(assignment);
                      setShowViewModal(true);
                    }}
                  >
                    <td className="px-4 py-3 text-sm">{new Date(assignment.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900">
                        {SERVICE_TYPE_OPTIONS.find((x) => x.value === assignment.serviceType)?.label ||
                          assignment.serviceType}
                      </div>
                      <div className="text-xs text-gray-500">{assignment.description}</div>
                    </td>
                    <td className="px-4 py-3 text-sm hidden sm:table-cell text-gray-700">
                      {volunteerNames(assignment)}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <StatusBadge status={assignment.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => navigate(`/volunteers/assignments/${assignment.id}/edit`)}
                        className="text-blue-600 hover:text-blue-800 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() =>
                          handleDeleteClick(assignment.id, new Date(assignment.date).toLocaleDateString())
                        }
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalPages * itemsPerPage}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </>
      )}

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
