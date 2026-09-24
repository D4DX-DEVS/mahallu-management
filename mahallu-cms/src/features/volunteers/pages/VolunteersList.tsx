import { useEffect, useState, useCallback } from 'react';
import { FiPlus } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { volunteerService, type VolunteerProfile, VOLUNTEER_WINGS } from '@/services/volunteerService';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

export default function VolunteersList() {
  const navigate = useNavigate();
  const [volunteers, setVolunteers] = useState<VolunteerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [wingFilter, setWingFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [totalPages, setTotalPages] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchVolunteers = async () => {
      try {
        setLoading(true);
        const result = await volunteerService.getVolunteers({
          page: currentPage,
          limit: itemsPerPage,
          wing: wingFilter || undefined,
          status: statusFilter || undefined,
        });
        setVolunteers(result.data);
        setTotalPages(result.pagination?.totalPages || 1);
      } catch (error) {
        console.error("Couldn't load volunteers:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchVolunteers();
  }, [currentPage, itemsPerPage, wingFilter, statusFilter]);

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteId) return;
    try {
      setDeleting(true);
      await volunteerService.deleteVolunteer(deleteId);
      setVolunteers((prev) => prev.filter((v) => v.id !== deleteId));
      toast.success('Volunteer deleted');
      setShowDeleteConfirm(false);
      setDeleteId(null);
    } catch (error) {
      toast.error("Couldn't delete volunteer. Please try again.");
      console.error("Couldn't delete volunteer:", error);
    } finally {
      setDeleting(false);
    }
  }, [deleteId]);

  const volunteerName = (volunteer: VolunteerProfile) => {
    if (volunteer.memberId && typeof volunteer.memberId === 'object') {
      return toTitleCase(volunteer.memberId.name);
    }
    return '-';
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Volunteers" description="People who have signed up to help, by wing." />
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex-1">
          <div className="flex gap-2 flex-wrap">
            {[
              { value: '', label: 'All Wings' },
              ...VOLUNTEER_WINGS.map((w) => ({ value: w.value, label: w.label })),
            ].map((wing) => (
              <button
                key={wing.value}
                onClick={() => {
                  setWingFilter(wing.value);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  wingFilter === wing.value
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {wing.label}
              </button>
            ))}
          </div>
        </div>
        <Button onClick={() => navigate('/volunteers/create')} icon={<FiPlus />} collapseLabel>
          Add Volunteer
        </Button>
      </div>

      {loading ? (
        <Card>
          <div className="py-8 text-center">Loading volunteers...</div>
        </Card>
      ) : volunteers.length === 0 ? (
        <Card>
          <div className="py-8 text-center text-gray-500">
            <p>No volunteers found</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {volunteers.map((volunteer) => (
              <Card
                key={volunteer.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate(`/volunteers/${volunteer.id}`)}
              >
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{volunteerName(volunteer)}</h3>
                      <p className="text-xs text-gray-500 mt-1">
                        {(volunteer.wings ?? [])
                          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                          .join(', ')}
                      </p>
                    </div>
                    <StatusBadge status={volunteer.status} />
                  </div>

                  <div className="pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-600">Service Types:</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(volunteer.serviceTypes ?? []).slice(0, 3).map((st) => (
                        <span
                          key={st}
                          className="inline-block bg-blue-50 text-blue-700 px-2 py-1 text-xs rounded"
                        >
                          {st.replace(/_/g, ' ')}
                        </span>
                      ))}
                      {(volunteer.serviceTypes ?? []).length > 3 && (
                        <span className="text-xs text-gray-500">
                          +{(volunteer.serviceTypes ?? []).length - 3}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/volunteers/${volunteer.id}/edit`);
                      }}
                      className="flex-1 px-2 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(volunteer.id);
                      }}
                      className="flex-1 px-2 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </Card>
            ))}
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

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Volunteer"
        message="Are you sure you want to delete this volunteer? This action cannot be undone."
        consequence="The volunteer record will be permanently removed from the system."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
