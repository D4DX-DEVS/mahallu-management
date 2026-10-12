import { useState, useEffect } from 'react';
import { FiPlus } from 'react-icons/fi';
import { getMedicalCamps, deleteMedicalCamp, IMedicalCamp } from '@/services/healthService';
import Pagination from '@/components/ui/Pagination';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import Segmented from '@/components/ui/Segmented';
import StatusBadge from '@/components/ui/StatusBadge';
import Table from '@/components/ui/Table';
import RowActions from '@/components/ui/RowActions';
import EmptyState from '@/components/ui/EmptyState';
import { TableColumn } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { useNavigate } from 'react-router-dom';
import { PersonCell } from '@/components/ui/Avatar';

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
      console.error('Failed to fetch medical camps:', error);
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
      toast.error(getFriendlyError(error, "Couldn't delete medical camp. Try again in a moment."));
      console.error('Failed to delete camp:', error);
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

  const columns: TableColumn<IMedicalCamp>[] = [
    { key: 'name', label: 'Camp', render: (v) => <PersonCell name={v} /> },
    { key: 'campDate', label: 'Date', render: (v) => formatDate(v) },
    { key: 'location', label: 'Location' },
    { key: 'organizer', label: 'Organizer', render: (v) => v || '-' },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, camp) => (
        <RowActions
          onEdit={() => navigate(`/health/camps/${camp.id}/edit`)}
          onDelete={() => {
            setDeleteId(camp.id);
            setConfirmDelete(true);
          }}
          ariaLabels={{ edit: 'Edit camp', delete: 'Delete camp' }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Medical camps"
        description={`${camps.length} camps found`}
        actions={
          <Button onClick={() => navigate('/health/camps/create')}>
            <FiPlus /> Add camp
          </Button>
        }
      />

      <Card padding="none" className="overflow-visible">
        <FilterBar search={{ value: search, onChange: setSearch, placeholder: 'Search by name' }}>
          <Segmented
            aria-label="Filter by status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: '', label: 'All status' },
              { value: 'planned', label: 'Planned' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
        </FilterBar>

        <div className="p-3.5">
          {loading ? (
            <LoadingSpinner />
          ) : camps.length === 0 ? (
            <EmptyState title="No medical camps found" description="Try adjusting your search or add a new camp." />
          ) : (
            <>
              <Table columns={columns} data={camps} showExport={false} />

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
        title="Delete medical camp?"
        message="This medical camp will be deleted. This cannot be undone."
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
