import React, { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiCalendar, FiMapPin } from 'react-icons/fi';
import { getMedicalCamps, deleteMedicalCamp, IMedicalCamp } from '@/services/healthService';
import Pagination from '@/components/ui/Pagination';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useNavigate } from 'react-router-dom';

export default function CampsList() {
  const navigate = useNavigate();
  const [camps, setCamps] = useState<IMedicalCamp[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const itemsPerPage = 10;

  const fetchCamps = async (page: number, searchTerm: string = '') => {
    try {
      setLoading(true);
      const response = await getMedicalCamps(page, itemsPerPage, '', searchTerm);
      setCamps(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
      setCurrentPage(response.pagination.page);
    } catch (error) {
      console.error('Failed to fetch medical camps:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCamps(1, search);
  }, [search]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMedicalCamp(deleteId);
      setConfirmDelete(false);
      setDeleteId(null);
      fetchCamps(currentPage, search);
    } catch (error) {
      console.error('Failed to delete camp:', error);
    }
  };

  const handlePageChange = (page: number) => {
    fetchCamps(page, search);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 sm:p-6 max-w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Medical Camps</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">{camps.length} camps found</p>
          </div>
          <Button
            onClick={() => navigate('/health/camps/create')}
            className="flex items-center gap-2"
          >
            <FiPlus /> Add Camp
          </Button>
        </div>

        <div className="mb-6">
          <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-3 py-2">
            <FiSearch className="text-gray-400" />
            <Input
              type="text"
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 border-none focus:ring-0"
            />
          </div>
        </div>

        {camps.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No medical camps found</p>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-6">
              {camps.map((camp) => (
                <div key={camp._id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1">
                      <h3 className="text-base sm:text-lg font-semibold">{camp.name}</h3>
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
                          Organizer: {camp.organizer}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => navigate(`/health/camps/${camp._id}/edit`)}
                        className="flex items-center gap-1"
                      >
                        <FiEdit2 className="w-4 h-4" /> Edit
                      </Button>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setDeleteId(camp._id);
                          setConfirmDelete(true);
                        }}
                        className="flex items-center gap-1"
                      >
                        <FiTrash2 className="w-4 h-4" /> Delete
                      </Button>
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

      <Modal
        isOpen={confirmDelete}
        title="Delete Medical Camp"
        onClose={() => setConfirmDelete(false)}
      >
        <p className="text-gray-700 mb-6">Are you sure you want to delete this medical camp?</p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Delete
          </Button>
        </div>
      </Modal>
    </div>
  );
}
