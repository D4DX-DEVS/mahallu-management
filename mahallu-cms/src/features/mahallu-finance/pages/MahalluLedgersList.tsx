import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBookOpen, FiDownload, FiFileText, FiFile } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import RowActions from '@/components/ui/RowActions';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import FilterBar from '@/components/ui/FilterBar';
import Dropdown from '@/components/ui/Dropdown';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { masterAccountService, Ledger } from '@/services/masterAccountService';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { ROUTES } from '@/constants/routes';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { PersonCell } from '@/components/ui/Avatar';

export default function MahalluLedgersList() {
  const navigate = useNavigate();
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selected, setSelected] = useState<Ledger | null>(null);
  const [deleting, setDeleting] = useState(false);
  const itemsPerPage = 10;

  useEffect(() => { fetchLedgers(); }, [currentPage]);

  const fetchLedgers = async () => {
    try {
      setLoading(true);
      setError(null);
      // instituteId not sent → backend returns mahallu-scope (instituteId: null) ledgers
      const result = await masterAccountService.getAllLedgers({ page: currentPage, limit: itemsPerPage, scope: 'mahallu' });
      setLedgers(Array.isArray(result.data) ? result.data : []);
      if (result.pagination) setPagination(result.pagination);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load ledgers. Refresh the page or try again."));
      setLedgers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      setDeleting(true);
      await masterAccountService.deleteLedger(selected.id);
      setShowDeleteModal(false);
      fetchLedgers();
      toast.success('Ledger deleted');
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't delete ledger. Try again in a moment."));
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      const result = await masterAccountService.getAllLedgers({ limit: 10000, scope: 'mahallu' });
      const data = Array.isArray(result.data) ? result.data : [];
      if (!data.length) { toast.info('Nothing to export. Change your filters and try again.'); return; }
      if (type === 'csv') exportToCSV(columns, data, 'mahallu-ledgers');
      else if (type === 'json') exportToJSON(columns, data, 'mahallu-ledgers');
      else exportToPDF(columns, data, 'mahallu-ledgers', 'Mahallu Ledgers');
    } catch (err: any) { toast.error(getFriendlyError(err, "Couldn't export ledgers. Check your connection and try again.")); }
    finally { setIsExporting(false); }
  };

  const filtered = ledgers.filter(l => !searchQuery || l.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const columns: TableColumn<Ledger>[] = [
    { key: 'id', label: 'No.', render: (_, __, i) => i + 1 },
    { key: 'name', label: 'Name', render: (v) => <PersonCell name={v} /> },
    { key: 'type', label: 'Type', render: (t) => (
      <Badge variant={t === 'income' ? 'success' : 'danger'} dot className="capitalize">{t}</Badge>
    )},
    { key: 'description', label: 'Description' },
    { key: 'createdAt', label: 'Created', render: (d) => formatDate(d) },
    { key: 'actions', label: 'Actions', render: (_, row) => (
      <RowActions
        onEdit={() => navigate(ROUTES.MAHALLU_FINANCE.LEDGERS_EDIT(row.id), { state: { ledger: row } })}
        onDelete={() => { setSelected(row); setShowDeleteModal(true); }}
        ariaLabels={{ edit: 'Edit', delete: 'Delete' }}
      />
    )},
  ];


  return (
    <div className="space-y-4">
      <PageHeader title="Mahallu Ledgers" description="Chart of accounts for the Mahallu"
        actions={
          <Button onClick={() => navigate(ROUTES.MAHALLU_FINANCE.LEDGERS_CREATE)}><FiBookOpen className="h-3.5 w-3.5" />Add Ledger</Button>
        }
      />

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search ledgers' }}
          actions={
            <>
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
        />

        <div className="p-3.5">
          {loading ? <div className="flex justify-center py-12"><LoadingSpinner /></div>
            : error ? <Alert tone="danger">{error}</Alert>
            : <>
              <Table columns={columns} data={filtered} emptyMessage="No ledgers found" />
              {pagination && <Pagination currentPage={currentPage} totalPages={pagination.totalPages || 1} totalItems={pagination.total || 0} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />}
            </>}
      
        </div>
      </Card>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete ledger?">
        <p className="text-[#5B6963] dark:text-surface-muted mb-6">Delete ledger <strong>{selected?.name}</strong>?</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button variant="danger-solid" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</Button>
        </div>
      </Modal>
    </div>
  );
}
