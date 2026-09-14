import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiPhone } from 'react-icons/fi';
import { getHealthResources, deleteHealthResource, IHealthResource } from '@/services/healthService';
import Pagination from '@/components/ui/Pagination';
import ExpandableSearch from '@/components/ui/ExpandableSearch';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/store/toastStore';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

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
      const response = await getHealthResources(
        page,
        itemsPerPage,
        'blood_donor',
        'active',
        bloodGroup,
        searchTerm
      );
      setDonors(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
      setCurrentPage(response.pagination.page);
    } catch (error) {
      console.error("Couldn't load blood donors:", error);
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
      toast.success('Donor removed');
    } catch (error) {
      const message =
        error instanceof Error && 'response' in error
          ? (error.response as any)?.data?.message || "Couldn't remove donor"
          : "Couldn't remove donor";
      toast.error(message);
      console.error("Couldn't delete blood donor:", error);
    }
  };

  const handlePageChange = (page: number) => {
    fetchDonors(page, search, selectedBloodGroup);
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div>
      <div className="max-w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <PageHeader title="Blood Donors" description={`${donors.length} donors found`} />
          </div>
          <Button onClick={() => navigate('/health/donors/create')} className="flex items-center gap-2">
            <FiPlus /> Add Donor
          </Button>
        </div>

        <div className="mb-4 space-y-4">
          <ExpandableSearch
            value={search}
            onChange={(value) => setSearch(value)}
            entity="blood donors"
            placeholder="Search by name"
          />

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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              {donors.map((donor) => (
                <div key={donor.id} className="rounded-lg border border-border bg-card p-3 sm:p-4">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-base sm:text-lg font-semibold">{toTitleCase(donor.name)}</h3>
                    {donor.bloodGroup && (
                      <span className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm font-semibold">
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
                  <div className="flex gap-2 items-center">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => navigate(`/health/donors/${donor.id}/edit`)}
                      className="flex-1 flex items-center justify-center gap-1" icon={<FiEdit2 />} collapseLabel>Edit</Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => {
                        setDeleteId(donor.id);
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

      <Modal isOpen={confirmDelete} title="Delete Blood Donor" onClose={() => setConfirmDelete(false)}>
        <p className="text-gray-700 mb-4">Are you sure you want to delete this blood donor?</p>
        <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-3">
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
