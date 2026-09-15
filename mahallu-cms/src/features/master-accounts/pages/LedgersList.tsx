import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiBook, FiPlus } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import FilterPanel from '@/components/ui/FilterPanel';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import { PageSkeleton } from '@/components/ui/Skeleton';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { masterAccountService, Ledger } from '@/services/masterAccountService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import { formatDate, toTitleCase } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

export default function LedgersList() {
  const { currentInstituteId: userInstituteId } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [institutes, setInstitutes] = useState<{ id: string; name: string }[]>([]);
  const [instituteFilter, setInstituteFilter] = useState(userInstituteId || 'all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedLedger, setSelectedLedger] = useState<Ledger | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', type: 'income' as string, description: '' });

  useEffect(() => {
    if (!userInstituteId) {
      // The API caps `limit` at 100 and answers 400 above it — getAllForExport
      // pages through all institutes instead of failing the dropdown silently.
      instituteService
        .getAllForExport()
        .then((rows) => setInstitutes(rows.map((i: any) => ({ id: i.id, name: i.name }))))
        .catch((err) => toast.error(loadErrorMessage(err, 'institutes')));
    }
  }, []);

  useEffect(() => {
    fetchLedgers();
  }, [currentPage, instituteFilter]);

  const fetchLedgers = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
      };
      if (instituteFilter !== 'all') params.instituteId = instituteFilter;
      const result = await masterAccountService.getAllLedgers(params);
      setLedgers(Array.isArray(result.data) ? result.data : []);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(loadErrorMessage(err, 'ledgers'));
      console.error('Error fetching ledgers:', err);
      setLedgers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);

      const params: any = { limit: 10000 };
      if (instituteFilter !== 'all') params.instituteId = instituteFilter;
      const result = await masterAccountService.getAllLedgers(params);
      const dataToExport = Array.isArray(result.data) ? result.data : [];

      if (dataToExport.length === 0) {
        toast.info('No ledgers to export');
        return;
      }

      const filename = 'ledgers';
      const title = 'All Ledgers';

      switch (type) {
        case 'csv':
          exportToCSV(columns, dataToExport, filename);
          break;
        case 'json':
          exportToJSON(columns, dataToExport, filename);
          break;
        case 'pdf':
          exportToPDF(columns, dataToExport, filename, title);
          break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error?.message || "Couldn't export ledgers");
    } finally {
      setIsExporting(false);
    }
  };

  // The list endpoint has no `search` query param, so — same as the Mahallu
  // Finance ledgers screen — the search box filters the page already loaded.
  const filteredLedgers = ledgers.filter(
    (l) => !searchQuery || l.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns: TableColumn<Ledger>[] = [
    {
      key: 'name',
      label: 'Name',
      width: '6.75rem',
      sortable: true,
      render: (v) => <span>{toTitleCase(v)}</span>,
    },
    { key: 'type', label: 'Type', width: '6.25rem' },
    { key: 'description', label: 'Description', width: '9.25rem' },
    {
      key: 'createdAt',
      label: 'Created',
      width: '7.75rem',
      render: (date) => formatDate(date),
    },
  ];

  const openEditModal = (ledger: Ledger) => {
    setSelectedLedger(ledger);
    setEditForm({ name: ledger.name, type: ledger.type || 'income', description: ledger.description || '' });
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!selectedLedger) return;
    try {
      await masterAccountService.updateLedger(selectedLedger.id, editForm);
      await fetchLedgers();
      setShowEditModal(false);
      setSelectedLedger(null);
    } catch (err: any) {
      // A failed edit must not blank the list behind the still-open modal —
      // that used to happen because this reused the page-level fetch error.
      toast.error(errorMessage(err, { action: 'update ledger' }));
    }
  };

  const handleDelete = async () => {
    if (!selectedLedger) return;
    try {
      setDeleting(true);
      await masterAccountService.deleteLedger(selectedLedger.id);
      await fetchLedgers();
      setShowDeleteModal(false);
      setSelectedLedger(null);
    } catch (err: any) {
      // Same here — e.g. the "ledger has N item(s)" guard used to replace the
      // whole table with a full-page error instead of a message on the modal.
      toast.error(errorMessage(err, { action: 'delete ledger' }));
    } finally {
      setDeleting(false);
    }
  };

  const stats = [
    {
      title: 'Total Ledgers',
      value: pagination?.total || ledgers.length,
      icon: <FiBook className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <PageHeader title="Ledgers" description="Manage ledgers" />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-1">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
          isFilterVisible={isFilterVisible}
          hasFilters={!userInstituteId}
          onRefresh={fetchLedgers}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={
            <Link to="/master-accounts/ledgers/create">
              <Button size="md" icon={<FiPlus />} collapseLabel>New Ledger</Button>
            </Link>
          }
        />

        {isFilterVisible && !userInstituteId && (
          <FilterPanel>
            <div className="w-full sm:w-64">
              <Select
                label="Institute"
                options={[
                  { value: 'all', label: 'All Institutes' },
                  ...institutes.map((i) => ({ value: i.id, label: toTitleCase(i.name) })),
                ]}
                value={instituteFilter}
                onChange={(e) => {
                  setInstituteFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </FilterPanel>
        )}

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchLedgers} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <>
            <Table
              fixedLayout
              striped
              columns={columns}
              data={filteredLedgers}
              emptyMessage="No ledgers found"
              showExport={false}
              onRowClick={(row) => {
                setSelectedLedger(row);
                setShowViewModal(true);
              }}
            />
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
                />
              </div>
            )}
          </>
        )}
      </TableCard>

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedLedger(null);
        }}
        title="Ledger Details"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowViewModal(false);
                setSelectedLedger(null);
              }}
            >
              Close
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (selectedLedger) openEditModal(selectedLedger);
                setShowViewModal(false);
              }}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setShowViewModal(false);
                setShowDeleteModal(true);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        {selectedLedger && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Name</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">{toTitleCase(selectedLedger.name)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Type</p>
              <p className="text-gray-900 dark:text-gray-100 capitalize">{selectedLedger.type || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Institute</p>
              <p className="text-gray-900 dark:text-gray-100">
                {toTitleCase(institutes.find((i) => i.id === (selectedLedger as any).instituteId)?.name) || '—'}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Description</p>
              <p className="text-gray-900 dark:text-gray-100">{selectedLedger.description || '—'}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
              <p className="text-gray-900 dark:text-gray-100">{formatDate(selectedLedger.createdAt)}</p>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedLedger(null);
        }}
        title="Edit Ledger"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditModal(false);
                setSelectedLedger(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleEdit}>Save Changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Name"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
          />
          <Select
            label="Type"
            value={editForm.type}
            onChange={(e) => setEditForm({ ...editForm, type: e.target.value })}
            options={[
              { value: 'income', label: 'Income' },
              { value: 'expense', label: 'Expense' },
            ]}
          />
          <Input
            label="Description"
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
          />
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedLedger(null);
        }}
        title="Delete Ledger"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedLedger(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          Are you sure you want to delete <strong>{toTitleCase(selectedLedger?.name)}</strong>? This action cannot be
          undone.
        </p>
      </Modal>
    </div>
  );
}
