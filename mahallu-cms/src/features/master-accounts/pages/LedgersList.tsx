import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiBook, FiRefreshCw, FiDownload, FiFileText, FiFile } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import RowActions from '@/components/ui/RowActions';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import FilterBar from '@/components/ui/FilterBar';
import Dropdown from '@/components/ui/Dropdown';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { masterAccountService, Ledger } from '@/services/masterAccountService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import StatusBadge from '@/components/ui/StatusBadge';
import { PersonCell } from '@/components/ui/Avatar';

export default function LedgersList() {
  const { currentInstituteId: userInstituteId } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
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
  const [deleting, setDeleting] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', type: 'income' as string, description: '' });

  useEffect(() => {
    if (!userInstituteId) {
      instituteService.getAll({ limit: 1000 }).then(r => setInstitutes(r.data.map((i: any) => ({ id: i.id, name: i.name })))).catch(() => {});
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
      setError(getFriendlyError(err, "Couldn't load ledgers. Refresh the page or try again."));
      console.error('Error fetching ledgers:', err);
      setLedgers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);

      const params = { limit: 10000 };
      const result = await masterAccountService.getAllLedgers(params);
      const dataToExport = Array.isArray(result.data) ? result.data : [];

      if (dataToExport.length === 0) {
        toast.info('Nothing to export. Change your filters and try again.');
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
      toast.error(getFriendlyError(error, "Couldn't export ledgers. Check your connection and try again."));
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<Ledger>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'name', label: 'Name', sortable: true, render: (v) => <PersonCell name={v} /> },
    { key: 'type', label: 'Type', render: (t) => (t ? <StatusBadge status={t} tone={t === 'income' ? 'success' : t === 'expense' ? 'danger' : 'neutral'} dot={t === 'income' || t === 'expense'} /> : '-') },
    { key: 'description', label: 'Description' },
    {
      key: 'createdAt',
      label: 'Created',
      render: (date) => formatDate(date),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <RowActions
          onEdit={() => openEditModal(row)}
          onDelete={() => { setSelectedLedger(row); setShowDeleteModal(true); }}
          ariaLabels={{ edit: 'Edit', delete: 'Delete' }}
        />
      ),
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
      toast.error(getFriendlyError(err, "Couldn't update ledger. Try again in a moment."));
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
      toast.error(getFriendlyError(err, "Couldn't delete ledger. Try again in a moment."));
    } finally {
      setDeleting(false);
    }
  };

  const stats = [{ title: 'Total Ledgers', value: pagination?.total || ledgers.length, icon: <FiBook className="h-[17px] w-[17px]" /> }];

  return (
    <div className="space-y-4">
    <div className="space-y-3">
      <PageHeader title="Ledgers" description="Manage ledgers"
        actions={
          <Link to="/master-accounts/ledgers/create">
            <Button>
              + New ledger
            </Button>
          </Link>
        }
      />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-1">
          {stats.map((stat, index) => (
            <StatCard key={index} variant="inline" {...stat} />
          ))}
        </div>
      </div>

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search ledgers' }}
          actions={
            <>
              <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={fetchLedgers}>
                <FiRefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Dropdown
                trigger={
                  <Button variant="secondary" isLoading={isExporting}>
                    {!isExporting && <FiDownload className="h-3.5 w-3.5" />}
                    Export
                  </Button>
                }
                items={[
                  { label: 'Export CSV', icon: <FiFileText />, onClick: () => handleExport('csv'), disabled: isExporting },
                  { label: 'Export JSON', icon: <FiFile />, onClick: () => handleExport('json'), disabled: isExporting },
                  { label: 'Export PDF', icon: <FiDownload />, onClick: () => handleExport('pdf'), disabled: isExporting },
                ]}
              />
            </>
          }
        >
          {!userInstituteId && (
            <>
              <div className="w-64">
                <Select
                  options={[{ value: 'all', label: 'All Institutes' }, ...institutes.map(i => ({ value: i.id, label: i.name }))]}
                  value={instituteFilter}
                  onChange={(e) => setInstituteFilter(e.target.value)}
                />
              </div>
            </>
          )}
        </FilterBar>

        <div className="p-3.5">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-[#B3261E] dark:text-red-300">{error}</p>
              <Button onClick={fetchLedgers} className="mt-4" variant="outline">
                Retry
              </Button>
            </div>
          ) : (
            <>
              <Table columns={columns} data={ledgers} emptyMessage="No ledgers found" showExport={false} />
              {pagination && pagination.totalPages > 1 && (
                <div className="mt-3.5">
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
      
        </div>
      </Card>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setSelectedLedger(null); }}
        title="Edit Ledger"
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowEditModal(false); setSelectedLedger(null); }}>Cancel</Button>
            <Button onClick={handleEdit}>Save Changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
          <Select label="Type" value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value })} options={[{ value: 'income', label: 'Income' }, { value: 'expense', label: 'Expense' }]} />
          <Input label="Description" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setSelectedLedger(null); }}
        title="Delete ledger?"
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowDeleteModal(false); setSelectedLedger(null); }}>Cancel</Button>
            <Button variant="danger-solid" onClick={handleDelete} isLoading={deleting}>Delete</Button>
          </>
        }
      >
        <p className="text-[13px] text-[#5B6963] dark:text-surface-muted">
          Delete <strong>{selectedLedger?.name}</strong>? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

