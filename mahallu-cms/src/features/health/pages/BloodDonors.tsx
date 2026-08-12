import React, { useState, useEffect } from 'react';
import { FiPlus, FiSearch, FiEdit2, FiTrash2, FiPhone } from 'react-icons/fi';
import { getHealthResources, deleteHealthResource, IHealthResource } from '@/services/healthService';
import Pagination from '@/components/ui/Pagination';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import { useNavigate } from 'react-router-dom';

export default function BloodDonors() {
  const navigate = useNavigate();
  const [donors, setDonors] = useState<IHealthResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedBloodGroup, setSelectedBloodGroup] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const itemsPerPage = 10;
  const bloodGroups = ['A +ve', 'A -ve', 'B +ve', 'B -ve', 'AB +ve', 'AB -ve', 'O +ve', 'O -ve'];

  const fetchDonors = async (page: number, searchTerm: string = '', bloodGroup: string = '') => {
    try {
      setLoading(true);
      const response = await getHealthResources(page, itemsPerPage, 'blood_donor', 'active', bloodGroup, searchTerm);
      setDonors(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
      setCurrentPage(response.pagination.page);
    } catch (error) {
      console.error('Failed to fetch blood donors:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDonors(1, search, selectedBloodGroup);
  }, [search, selectedBloodGroup]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteHealthResource(deleteId);
      setConfirmDelete(false);
      setDeleteId(null);
      fetchDonors(currentPage, search, selectedBloodGroup);
    } catch (error) {
      console.error('Failed to delete blood donor:', error);
    }
  };

  const handlePageChange = (page: number) => {
    fetchDonors(page, search, selectedBloodGroup);
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 sm:p-6 max-w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Blood Donors</h1>
            <p className="text-sm sm:text-base text-gray-600 mt-1">{donors.length} donors found</p>
          </div>
          <Button
            onClick={() => navigate('/health/donors/create')}
            className="flex items-center gap-2"
          >
            <FiPlus /> Add Donor
          </Button>
        </div>

        <div className="mb-6 space-y-4">
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

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedBloodGroup('')}
              className={`px-3 py-1 rounded-full text-sm ${
                selectedBloodGroup === ''
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
              }`}
            >
              All Blood Types
            </button>
            {bloodGroups.map((bg) => (
              <button
                key={bg}
                onClick={() => setSelectedBloodGroup(bg)}
                className={`px-3 py-1 rounded-full text-sm ${
                  selectedBloodGroup === bg
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                }`}
              >
                {bg}
              </button>
            ))}
          </div>
        </div>

        {donors.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">No blood donors found</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {donors.map((donor) => (
                <div key={donor._id} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-base sm:text-lg font-semibold">{donor.name}</h3>
                    {donor.bloodGroup && (
                      <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-bold">
                        {donor.bloodGroup}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-700 mb-3">
                    <FiPhone className="text-green-600" />
                    {donor.contactNo}
                  </div>
                  {donor.availability && (
                    <p className="text-xs sm:text-sm text-gray-600 mb-3">
                      Availability: {donor.availability}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/health/donors/${donor._id}/edit`)}
                      className="flex-1 flex items-center justify-center gap-1"
                    >
                      <FiEdit2 className="w-4 h-4" /> Edit
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setDeleteId(donor._id);
                        setConfirmDelete(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-1"
                    >
                      <FiTrash2 className="w-4 h-4" /> Delete
                    </Button>
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
        title="Delete Blood Donor"
        onClose={() => setConfirmDelete(false)}
      >
        <p className="text-gray-700 mb-6">Are you sure you want to delete this blood donor?</p>
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
