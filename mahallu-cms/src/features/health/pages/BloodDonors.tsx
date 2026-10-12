import { useState, useEffect } from 'react';
import { FiPlus, FiPhone } from 'react-icons/fi';
import { getHealthResources, deleteHealthResource, IHealthResource } from '@/services/healthService';
import Pagination from '@/components/ui/Pagination';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import Segmented from '@/components/ui/Segmented';
import RowActions from '@/components/ui/RowActions';
import Avatar from '@/components/ui/Avatar';
import BloodGroupBadge from '@/components/ui/BloodGroupBadge';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { useNavigate } from 'react-router-dom';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

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
      toast.success('Donor removed');
    } catch (error) {
      toast.error(getFriendlyError(error, "Couldn't remove donor. Try again in a moment."));
      console.error('Failed to delete blood donor:', error);
    }
  };

  const handlePageChange = (page: number) => {
    fetchDonors(page, search, selectedBloodGroup);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Blood donors"
        description={`${donors.length} donors found`}
        actions={
          <Button onClick={() => navigate('/health/donors/create')}>
            <FiPlus /> Add donor
          </Button>
        }
      />

      <Card padding="none" className="overflow-visible">
        <FilterBar search={{ value: search, onChange: setSearch, placeholder: 'Search by name' }}>
          <Segmented
            size="sm"
            aria-label="Filter by blood group"
            value={selectedBloodGroup}
            onChange={setSelectedBloodGroup}
            options={[{ value: '', label: 'All Blood Types' }, ...bloodGroups.map((bg) => ({ value: bg, label: bg }))]}
          />
        </FilterBar>

        <div className="p-3.5">
          {loading ? (
            <LoadingSpinner />
          ) : donors.length === 0 ? (
            <EmptyState title="No blood donors found" description="Try adjusting your search or add a new donor." />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {donors.map((donor) => (
                  <Card key={donor.id} hoverEffect>
                    <div className="mb-2.5 flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={donor.name} size={40} />
                        <h3 className="truncate text-[13px] font-bold text-[#18231E] dark:text-surface-text">{donor.name}</h3>
                      </div>
                      {donor.bloodGroup && <BloodGroupBadge value={donor.bloodGroup} />}
                    </div>
                    <div className="mb-2.5 flex items-center gap-2 text-xs text-[#5B6963] dark:text-surface-muted">
                      <FiPhone className="text-primary-600 dark:text-brand-lime" />
                      {donor.contactNo}
                    </div>
                    {donor.availability && (
                      <p className="mb-2.5 text-xs text-[#7B8983] dark:text-surface-muted">
                        Availability: {donor.availability}
                      </p>
                    )}
                    <div className="flex justify-end">
                      <RowActions
                        onEdit={() => navigate(`/health/donors/${donor.id}/edit`)}
                        onDelete={() => {
                          setDeleteId(donor.id);
                          setConfirmDelete(true);
                        }}
                        ariaLabels={{ edit: `Edit ${donor.name}`, delete: `Delete ${donor.name}` }}
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
        title="Delete blood donor?"
        message="This blood donor will be deleted. This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
