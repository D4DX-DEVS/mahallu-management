import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiFileMinus, FiDownload, FiFileText, FiFile, FiTrendingUp, FiTrendingDown, FiDollarSign } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import RowActions from '@/components/ui/RowActions';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import StatCard from '@/components/ui/StatCard';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import FilterBar from '@/components/ui/FilterBar';
import Dropdown from '@/components/ui/Dropdown';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { masterAccountService, LedgerItem, Ledger } from '@/services/masterAccountService';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { ROUTES } from '@/constants/routes';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { pct } from '@/utils/statSeries';
import StatusBadge from '@/components/ui/StatusBadge';

export default function MahalluLedgerItemsList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selected, setSelected] = useState<LedgerItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const itemsPerPage = 10;

  useEffect(() => {
    // Fetch mahallu-level ledgers (no instituteId) for the dropdown
    masterAccountService.getAllLedgers({ limit: 1000, scope: 'mahallu' }).then(r => setLedgers(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  useEffect(() => { fetchItems(); }, [ledgerFilter, currentPage]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { page: currentPage, limit: itemsPerPage, scope: 'mahallu' };
      if (ledgerFilter !== 'all') params.ledgerId = ledgerFilter;
      const result = await masterAccountService.getLedgerItems(params);
      setItems(Array.isArray(result.data) ? result.data : []);
      if (result.pagination) setPagination(result.pagination);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load ledger items. Refresh the page or try again."));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      setDeleting(true);
      await masterAccountService.deleteLedgerItem(selected.id);
      setShowDeleteModal(false);
      fetchItems();
      toast.success('Ledger entry deleted');
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't delete ledger entry. Try again in a moment."));
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      const result = await masterAccountService.getLedgerItems({ limit: 10000, scope: 'mahallu' });
      const data = Array.isArray(result.data) ? result.data : [];
      if (!data.length) { toast.info('Nothing to export. Change your filters and try again.'); return; }
      if (type === 'csv') exportToCSV(columns, data, 'mahallu-ledger-items');
      else if (type === 'json') exportToJSON(columns, data, 'mahallu-ledger-items');
      else exportToPDF(columns, data, 'mahallu-ledger-items', 'Mahallu Ledger Items');
    } catch (err: any) { toast.error(getFriendlyError(err, "Couldn't export ledger entries. Check your connection and try again.")); }
    finally { setIsExporting(false); }
  };

  const filtered = items.filter(i => !searchQuery || (i.description || '').toLowerCase().includes(searchQuery.toLowerCase()));

  const totalIncome = items.filter(i => i.type === 'income').reduce((s, i) => s + i.amount, 0);
  const totalExpense = items.filter(i => i.type === 'expense').reduce((s, i) => s + i.amount, 0);

  const columns: TableColumn<LedgerItem>[] = [
    { key: 'id', label: 'No.', render: (_, __, idx) => idx + 1 },
    { key: 'date', label: 'Date', render: (d) => formatDate(d) },
    { key: 'description', label: 'Description' },
    { key: 'type', label: 'Type', render: (t) => (
      <Badge variant={t === 'income' ? 'success' : 'danger'} dot className="capitalize">{t}</Badge>
    )},
    { key: 'amount', label: 'Amount', render: (a, row) => <span className={row.type === 'income' ? 'font-semibold text-[#0B4837] dark:text-brand-lime' : 'font-semibold text-[#B3261E] dark:text-red-300'}>{`₹${(a || 0).toLocaleString()}`}</span> },
    { key: 'paymentMethod', label: 'Method', render: (m) => (m ? <StatusBadge status={m} tone="neutral" dot={false} /> : '-') },
    { key: 'source', label: 'Source', render: (s) => <StatusBadge status={s || 'manual'} tone="neutral" dot={false} /> },
    { key: 'actions', label: 'Actions', render: (_, row) => row.source === 'manual' ? (
      <RowActions onDelete={() => { setSelected(row); setShowDeleteModal(true); }} ariaLabels={{ delete: 'Delete' }} />
    ) : null },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Mahallu Ledger Items" description="Manual journal entries for the Mahallu"
        actions={
          <Button onClick={() => navigate(ROUTES.MAHALLU_FINANCE.LEDGER_ITEMS_CREATE)}><FiFileMinus className="h-3.5 w-3.5" />Add Entry</Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard variant="inline" title="Total Income" value={`₹${totalIncome.toLocaleString()}`} tone="green" icon={<FiTrendingUp className="h-[17px] w-[17px]" />} />
        <StatCard variant="inline" viz={totalIncome > 0 ? { type: 'bullet', percent: pct(totalExpense, totalIncome), target: 100, color: totalExpense > totalIncome ? '#B3261E' : '#04563A' } : undefined} summary={`Expense ₹${(totalExpense).toLocaleString()}, ${pct(totalExpense, totalIncome)} percent of income`} title="Total Expense" value={`₹${totalExpense.toLocaleString()}`} tone="red" icon={<FiTrendingDown className="h-[17px] w-[17px]" />} />
        <StatCard variant="inline" viz={totalIncome + totalExpense > 0 ? { type: 'pair', a: totalIncome, b: totalExpense, colorB: '#E0B400' } : undefined} summary={`Income ₹${(totalIncome).toLocaleString()} compared with expense ₹${(totalExpense).toLocaleString()}`} title="Net Balance" value={`₹${(totalIncome - totalExpense).toLocaleString()}`} tone="neutral" icon={<FiDollarSign className="h-[17px] w-[17px]" />} />
      </div>

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search ledger items' }}
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
              <Table columns={columns} data={filtered} emptyMessage="No entries found" />
              {pagination && <Pagination currentPage={currentPage} totalPages={pagination.totalPages || 1} totalItems={pagination.total || 0} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />}
            </>}
      
        </div>
      </Card>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete entry?">
        <p className="text-[#5B6963] dark:text-surface-muted mb-6">Delete entry: <strong>{selected?.description}</strong>?</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button variant="danger-solid" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</Button>
        </div>
      </Modal>
    </div>
  );
}
