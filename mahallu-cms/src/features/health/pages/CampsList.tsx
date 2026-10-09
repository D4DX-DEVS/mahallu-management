import { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiEye, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { getMedicalCamps, deleteMedicalCamp, IMedicalCamp } from '@/services/healthService';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import Tabs from '@/components/ui/Tabs';
import Table from '@/components/ui/Table';
import StatusBadge from '@/components/ui/StatusBadge';
import ActionsMenu from '@/components/ui/ActionsMenu';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import PageHeader from '@/components/layout/PageHeader';
import { useNavigate } from 'react-router-dom';
import { TableColumn } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'planned', label: 'Planned' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const formatDate = (dateString: string) =>
  new Date(dateString).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

export default function CampsList() {
  const navigate = useNavigate();
  const [camps, setCamps] = useState<IMedicalCamp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedCamp, setSelectedCamp] = useState<IMedicalCamp | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);
  const isFiltered = Boolean(debouncedSearch || statusFilter);

  const fetchCamps = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getMedicalCamps(currentPage, itemsPerPage, statusFilter || undefined, debouncedSearch);
      setCamps(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err) {
      setError(loadErrorMessage(err, 'medical camps'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, statusFilter, debouncedSearch]);

  useEffect(() => {
    fetchCamps();
  }, [fetchCamps]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleting(true);
      await deleteMedicalCamp(deleteId);
      setConfirmDelete(false);
      setDeleteId(null);
      fetchCamps();
      toast.success('Medical camp deleted');
    } catch (err) {
      toast.error(errorMessage(err, { action: 'delete this medical camp' }));
    } finally {
      setDeleting(false);
    }
  };

  const openView = (camp: IMedicalCamp) => {
    setSelectedCamp(camp);
    setShowViewModal(true);
  };

  const askDelete = (camp: IMedicalCamp) => {
    setDeleteId(camp.id);
    setConfirmDelete(true);
  };

  const columns: TableColumn<IMedicalCamp>[] = [
    {
      key: 'name',
      label: 'Camp',
      sortable: true,
      width: '16rem',
      render: (name) => <span className="font-medium text-foreground">{toTitleCase(name)}</span>,
    },
    { key: 'campDate', label: 'Date', sortable: true, width: '9rem', render: (date) => (date ? formatDate(date) : '—') },
    { key: 'location', label: 'Location', sortable: true, priority: 'secondary', width: '12rem', render: (v) => (v ? toTitleCase(v) : '—') },
    { key: 'organizer', label: 'Organizer', priority: 'secondary', width: '12rem', render: (v) => (v ? toTitleCase(v) : '—') },
    { key: 'status', label: 'Status', sortable: true, width: '8rem', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'actions',
      label: '',
      width: '6.5rem',
      align: 'right',
      sortable: false,
      render: (_v, row) => (
        <ActionsMenu
          label={`Actions for ${toTitleCase(row.name)}`}
          items={[
            { label: 'View', icon: <FiEye className="h-4 w-4" />, onClick: () => openView(row) },
            { label: 'Edit', icon: <FiEdit2 className="h-4 w-4" />, onClick: () => navigate(`/health/camps/${row.id}/edit`) },
            { label: 'Delete', icon: <FiTrash2 className="h-4 w-4" />, variant: 'danger', onClick: () => askDelete(row) },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Medical camps"
        description="Camps organised for the community, past and planned."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => navigate('/health/camps/create')}>
            Add camp
          </Button>
        }
      />

      <TableCard>
        <TableToolbar
          tabs={
            <Tabs
              variant="segmented"
              ariaLabel="Camp status"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}
              items={STATUS_TABS}
            />
          }
          searchQuery={searchQuery}
          onSearchChange={(value) => {
            setSearchQuery(value);
            setCurrentPage(1);
          }}
          searchEntity="medical camps"
          onRefresh={fetchCamps}
        />

        {error ? (
          <EmptyState variant="error" entity="medical camps" description={error} action={{ label: 'Try again', onClick: fetchCamps }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={camps}
              isLoading={loading}
              entity="medical camps"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? {
                      label: 'Clear filters',
                      onClick: () => {
                        setSearchQuery('');
                        setStatusFilter('');
                        setCurrentPage(1);
                      },
                    }
                  : { label: 'Add camp', onClick: () => navigate('/health/camps/create') }
              }
              onRowClick={openView}
            />

            <div className="mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                entity="medical camps"
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(size) => {
                  setItemsPerPage(size);
                  setCurrentPage(1);
                }}
              />
            </div>
          </>
        )}
      </TableCard>

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
        title="Delete this medical camp?"
        message="This permanently removes the camp and cannot be undone."
        consequence="All camp details and associated records will be removed."
        confirmLabel="Delete camp"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setConfirmDelete(false);
          setDeleteId(null);
        }}
      />
    </>
  );
}
