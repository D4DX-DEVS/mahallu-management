import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiPhone } from 'react-icons/fi';
import { getHealthResources, deleteHealthResource, IHealthResource } from '@/services/healthService';
import Pagination from '@/components/ui/Pagination';
import ExpandableSearch from '@/components/ui/ExpandableSearch';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/layout/PageHeader';

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
      console.error("Couldn't load doctors:", error);
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
      toast.error("Couldn't delete doctor. Please try again.");
      console.error("Couldn't delete doctor:", error);
    } finally {
      setDeleting(false);
    }
  };

  const handlePageChange = (page: number) => {
    fetchDoctors(page, search);
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div>
      <div className="max-w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <PageHeader title="Doctors Directory" description={`${doctors.length} doctors found`} />
          </div>
          <Button onClick={() => navigate('/health/doctors/create')} className="flex items-center gap-2">
            <FiPlus /> Add Doctor
          </Button>
        </div>

        <div className="mb-4">
          <ExpandableSearch
            value={search}
            onChange={(value) => setSearch(value)}
            entity="doctors"
            placeholder="Search by name or specialty"
          />
        </div>

        {doctors.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No doctors found</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              {doctors.map((doctor) => (
                <div key={doctor.id} className="rounded-lg border border-border bg-card p-3 sm:p-4">
                  <h3 className="text-base sm:text-lg font-semibold capitalize">{doctor.name}</h3>
                  {doctor.specialty && (
                    <p className="text-xs sm:text-sm text-gray-600 mt-1">{doctor.specialty}</p>
                  )}
                  <div className="flex items-center gap-2 mt-3 text-xs sm:text-sm text-gray-700">
                    <FiPhone className="text-green-600" />
                    {doctor.contactNo}
                  </div>
                  {doctor.availability && (
                    <p className="text-xs sm:text-sm text-gray-600 mt-2">
                      Availability: {doctor.availability}
                    </p>
                  )}
                  <div className="flex gap-2 mt-4 items-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/health/doctors/${doctor.id}/edit`)}
                      className="flex-1 flex items-center justify-center gap-1" icon={<FiEdit2 />} collapseLabel>Edit</Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setDeleteId(doctor.id);
                        setConfirmDelete(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-1" icon={<FiTrash2 />} collapseLabel>Delete</Button>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
              />
            )}
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete Doctor"
        message="Are you sure you want to delete this doctor?"
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
