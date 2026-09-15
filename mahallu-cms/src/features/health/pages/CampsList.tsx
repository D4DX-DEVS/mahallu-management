import React, { useState, useEffect } from 'react';
import { FiPlus, FiCalendar, FiMapPin } from 'react-icons/fi';
import { getMedicalCamps, deleteMedicalCamp, IMedicalCamp } from '@/services/healthService';
import Pagination from '@/components/ui/Pagination';
import ExpandableSearch from '@/components/ui/ExpandableSearch';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import Modal from '@/components/ui/Modal';

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
  const [selectedCamp, setSelectedCamp] = useState<IMedicalCamp | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

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
                <div
                  key={camp.id}
                  className="rounded-lg border border-border bg-card p-3 sm:p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => {
                    setSelectedCamp(camp);
                    setShowViewModal(true);
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="text-base sm:text-lg font-semibold">{toTitleCase(camp.name)}</h3>
                      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-2 text-xs sm:text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <FiCalendar className="text-blue-600" />
                          {formatDate(camp.campDate)}
                        </div>
                        <div className="flex items-center gap-1">
                          <FiMapPin className="text-green-600" />
                          {toTitleCase(camp.location)}
                        </div>
                      </div>
                      {camp.organizer && (
                        <p className="text-xs sm:text-sm text-gray-600 mt-2">
                          Organizer: <span>{toTitleCase(camp.organizer)}</span>
                        </p>
                      )}
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

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedCamp(null);
        }}
        title="Medical Camp Details"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowViewModal(false);
                setSelectedCamp(null);
              }}
            >
              Close
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (selectedCamp) navigate(`/health/camps/${selectedCamp.id}/edit`);
              }}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (selectedCamp) setDeleteId(selectedCamp.id);
                setShowViewModal(false);
                setConfirmDelete(true);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        {selectedCamp && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Name</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">{toTitleCase(selectedCamp.name)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Date</p>
              <p className="text-gray-900 dark:text-gray-100">{formatDate(selectedCamp.campDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Location</p>
              <p className="text-gray-900 dark:text-gray-100">{toTitleCase(selectedCamp.location)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Organizer</p>
              <p className="text-gray-900 dark:text-gray-100">
                {selectedCamp.organizer ? toTitleCase(selectedCamp.organizer) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
              <p className="text-gray-900 dark:text-gray-100 capitalize">{selectedCamp.status}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Attendees</p>
              <p className="text-gray-900 dark:text-gray-100">{selectedCamp.attendeeCount ?? '—'}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Notes</p>
              <p className="text-gray-900 dark:text-gray-100">{selectedCamp.notes || '—'}</p>
            </div>
          </div>
        )}
      </Modal>

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
