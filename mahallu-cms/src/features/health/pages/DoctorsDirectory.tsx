import { useState, useEffect } from 'react';
import { FiPlus, FiPhone } from 'react-icons/fi';
import { getHealthResources, deleteHealthResource, IHealthResource } from '@/services/healthService';
import Pagination from '@/components/ui/Pagination';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import RowActions from '@/components/ui/RowActions';
import Avatar from '@/components/ui/Avatar';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { useNavigate } from 'react-router-dom';

export default function DoctorsDirectory() {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState<IHealthResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const itemsPerPage = 10;

  const fetchDoctors = async (page: number, searchTerm: string = '') => {
    try {
      setLoading(true);
      const response = await getHealthResources(page, itemsPerPage, 'doctor', 'active', '', searchTerm);
      setDoctors(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
      setCurrentPage(response.pagination.page);
    } catch (error) {
      console.error('Failed to fetch doctors:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDoctors(1, search);
  }, [search]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleting(true);
      await deleteHealthResource(deleteId);
      setConfirmDelete(false);
      setDeleteId(null);
      fetchDoctors(currentPage, search);
      toast.success('Doctor deleted');
    } catch (error) {
      toast.error(getFriendlyError(error, "Couldn't delete doctor. Try again in a moment."));
      console.error('Failed to delete doctor:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handlePageChange = (page: number) => {
    fetchDoctors(page, search);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Doctors directory"
        description={`${doctors.length} doctors found`}
        actions={
          <Button onClick={() => navigate('/health/doctors/create')}>
            <FiPlus /> Add doctor
          </Button>
        }
      />

      <Card padding="none" className="overflow-visible">
        <FilterBar search={{ value: search, onChange: setSearch, placeholder: 'Search by name or specialty' }} />

        <div className="p-3.5">
          {loading ? (
            <LoadingSpinner />
          ) : doctors.length === 0 ? (
            <EmptyState title="No doctors found" description="Try adjusting your search or add a new doctor." />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {doctors.map((doctor) => (
                  <Card key={doctor.id} hoverEffect>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={doctor.name} size={40} />
                      <div className="min-w-0">
                        <h3 className="truncate text-[13px] font-bold text-[#18231E] dark:text-surface-text">{doctor.name}</h3>
                        {doctor.specialty && (
                          <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">{doctor.specialty}</p>
                        )}
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-[#5B6963] dark:text-surface-muted">
                      <FiPhone className="text-primary-600 dark:text-brand-lime" />
                      {doctor.contactNo}
                    </div>
                    {doctor.availability && (
                      <p className="mt-2 text-xs text-[#7B8983] dark:text-surface-muted">
                        Availability: {doctor.availability}
                      </p>
                    )}
                    <div className="mt-4 flex justify-end">
                      <RowActions
                        onEdit={() => navigate(`/health/doctors/${doctor.id}/edit`)}
                        onDelete={() => {
                          setDeleteId(doctor.id);
                          setConfirmDelete(true);
                        }}
                        ariaLabels={{ edit: `Edit ${doctor.name}`, delete: `Delete ${doctor.name}` }}
                      />
                    </div>
                  </Card>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-3.5">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete doctor?"
        message="This doctor will be deleted. This cannot be undone."
        consequence="The doctor record will be permanently removed from the doctors directory."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setConfirmDelete(false);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
