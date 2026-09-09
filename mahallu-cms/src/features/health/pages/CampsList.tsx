import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiCalendar, FiMapPin } from 'react-icons/fi';
import { getMedicalCamps, deleteMedicalCamp, IMedicalCamp } from '@/services/healthService';
import Pagination from '@/components/ui/Pagination';
import ExpandableSearch from '@/components/ui/ExpandableSearch';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/layout/PageHeader';

export default function CampsList() {
  const navigate = useNavigate();
  const [camps, setCamps] = useState<IMedicalCamp[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const itemsPerPage = 10;

  const fetchCamps = async (page: number, searchTerm: string = '', status: string = '') => {
    try {
      setLoading(true);
      const response = await getMedicalCamps(page, itemsPerPage, status || undefined, searchTerm);
      setCamps(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
      setCurrentPage(response.pagination.page);
    } catch (error) {
      console.error("Couldn't load medical camps:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCamps(1, search, statusFilter);
  }, [search, statusFilter]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleting(true);
      await deleteMedicalCamp(deleteId);
      setConfirmDelete(false);
      setDeleteId(null);
      fetchCamps(currentPage, search, statusFilter);
      toast.success('Medical camp deleted');
    } catch (error) {
      toast.error("Couldn't delete medical camp. Please try again.");
      console.error("Couldn't delete camp:", error);
    } finally {
      setDeleting(false);
    }
  };

  const handlePageChange = (page: number) => {
    fetchCamps(page, search, statusFilter);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div>
      <div className="max-w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <PageHeader title="Medical Camps" description={`${camps.length} camps found`} />
          </div>
          <Button onClick={() => navigate('/health/camps/create')} className="flex items-center gap-2">
            <FiPlus /> Add Camp
          </Button>
        </div>

        <div className="mb-4 space-y-3">
          <ExpandableSearch
            value={search}
            onChange={(value) => setSearch(value)}
            entity="medical camps"
            placeholder="Search by name"
          />
          <div className="flex gap-2 flex-wrap">
            {['', 'planned', 'completed', 'cancelled'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1 text-xs rounded-full transition-colors ${
                  statusFilter === status
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status || 'All Status'}
              </button>
            ))}
          </div>
        </div>

        {camps.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No medical camps found</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-4">
              {camps.map((camp) => (
                <div key={camp.id} className="rounded-lg border border-border bg-card p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="text-base sm:text-lg font-semibold capitalize">{camp.name}</h3>
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <FiCalendar className="text-blue-600" />
                          {formatDate(camp.campDate)}
                        </div>
                        <div className="flex items-center gap-1">
                          <FiMapPin className="text-green-600" />
                          {camp.location}
                        </div>
                      </div>
                      {camp.organizer && (
                        <p className="text-xs sm:text-sm text-gray-600 mt-2">
                          Organizer: <span className="capitalize">{camp.organizer}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 items-center">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/health/camps/${camp.id}/edit`)}
                        className="flex items-center gap-1" icon={<FiEdit2 />} collapseLabel>Edit</Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setDeleteId(camp.id);
                          setConfirmDelete(true);
                        }}
                        className="flex items-center gap-1" icon={<FiTrash2 />} collapseLabel>Delete</Button>
                    </div>
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
        title="Delete Medical Camp"
        message="Are you sure you want to delete this medical camp?"
        consequence="All camp details and associated records will be permanently removed."
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
