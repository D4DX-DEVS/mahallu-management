import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { volunteerService, type VolunteerProfile, VOLUNTEER_WINGS } from '@/services/volunteerService';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import RowActions from '@/components/ui/RowActions';
import Avatar from '@/components/ui/Avatar';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import Segmented from '@/components/ui/Segmented';
import StatusBadge from '@/components/ui/StatusBadge';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

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
        console.error('Failed to fetch volunteers:', error);
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
      toast.error(getFriendlyError(error, "Couldn't delete volunteer. Try again in a moment."));
      console.error('Failed to delete volunteer:', error);
    } finally {
      setDeleting(false);
    }
  }, [deleteId]);

  const volunteerName = (volunteer: VolunteerProfile) => {
    if (volunteer.memberId && typeof volunteer.memberId === 'object') {
      return volunteer.memberId.name;
    }
    return '-';
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Volunteers"
        description="Volunteer profiles by wing and service type"
        actions={<Button onClick={() => navigate('/volunteers/create')}>+ Add volunteer</Button>}
      />

      <Card padding="none" className="overflow-visible">
        <FilterBar>
          <Segmented
            size="sm"
            aria-label="Filter by wing"
            value={wingFilter}
            onChange={(value) => {
              setWingFilter(value);
              setCurrentPage(1);
            }}
            options={[
              { value: '', label: 'All Wings' },
              ...VOLUNTEER_WINGS.map((w) => ({ value: w.value, label: w.label })),
            ]}
          />
        </FilterBar>

        <div className="p-3.5">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : volunteers.length === 0 ? (
            <EmptyState title="No volunteers found" description="Try another wing or add a new volunteer." />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {volunteers.map((volunteer) => (
                  <Card
                    key={volunteer.id}
                    hoverEffect
                    className="cursor-pointer"
                    onClick={() => navigate(`/volunteers/${volunteer.id}`)}
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-2.5">
                          <Avatar name={volunteerName(volunteer)} size={40} />
                          <div className="min-w-0">
                            <h3 className="truncate text-[13px] font-bold text-[#18231E] dark:text-surface-text">{volunteerName(volunteer)}</h3>
                            <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">
                              {volunteer.wings.map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(', ')}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={volunteer.status} size="sm" />
                      </div>

                      <div className="border-t border-line-soft pt-2.5 dark:border-surface-border">
                        <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#7B8983] dark:text-surface-muted">Service Types</p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {volunteer.serviceTypes.slice(0, 3).map((st) => (
                            <Badge key={st} variant="primary" size="sm" className="capitalize">
                              {st.replace(/_/g, ' ')}
                            </Badge>
                          ))}
                          {volunteer.serviceTypes.length > 3 && (
                            <span className="text-xs text-[#7B8983] dark:text-surface-muted">
                              +{volunteer.serviceTypes.length - 3}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-end pt-1">
                        <RowActions
                          onEdit={() => navigate(`/volunteers/${volunteer.id}/edit`)}
                          onDelete={() => handleDeleteClick(volunteer.id)}
                          ariaLabels={{ edit: 'Edit volunteer', delete: 'Delete volunteer' }}
                        />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

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
        isOpen={showDeleteConfirm}
        title="Delete volunteer?"
        message="Delete this volunteer? This cannot be undone."
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
