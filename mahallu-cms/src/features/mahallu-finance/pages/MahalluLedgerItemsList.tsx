import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiFileMinus, FiTrash2 } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import { rowActionClass } from '@/components/ui/rowAction';
import StatCard from '@/components/ui/StatCard';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import { PageSkeleton } from '@/components/ui/Skeleton';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { masterAccountService, LedgerItem, Ledger } from '@/services/masterAccountService';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { ROUTES } from '@/constants/routes';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

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
    masterAccountService
      .getAllLedgers({ limit: 1000, scope: 'mahallu' })
      .then((r) => setLedgers(Array.isArray(r.data) ? r.data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchItems();
  }, [ledgerFilter, currentPage]);

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
      setError(loadErrorMessage(err, 'ledger items'));
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
      toast.error(errorMessage(err, { action: 'delete ledger entry' }));
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      const result = await masterAccountService.getLedgerItems({ limit: 10000, scope: 'mahallu' });
      const data = Array.isArray(result.data) ? result.data : [];
      if (!data.length) {
        toast.info('No ledger entries to export');
        return;
      }
      if (type === 'csv') exportToCSV(columns, data, 'mahallu-ledger-items');
      else if (type === 'json') exportToJSON(columns, data, 'mahallu-ledger-items');
      else exportToPDF(columns, data, 'mahallu-ledger-items', 'Mahallu Ledger Items');
    } catch (err: any) {
      toast.error(err?.message || "Couldn't export ledger entries");
    } finally {
      setIsExporting(false);
    }
  };

  const filtered = items.filter(
    (i) => !searchQuery || (i.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalIncome = items.filter((i) => i.type === 'income').reduce((s, i) => s + i.amount, 0);
  const totalExpense = items.filter((i) => i.type === 'expense').reduce((s, i) => s + i.amount, 0);

  const columns: TableColumn<LedgerItem>[] = [
    { key: 'id', label: 'No.', width: '6rem', render: (_, __, idx) => idx + 1 },
    { key: 'date', label: 'Date', width: '6.25rem', render: (d) => formatDate(d) },
    { key: 'description', label: 'Description', width: '9.25rem' },
    {
      key: 'type',
      label: 'Type',
      width: '6.25rem',
      render: (t) => (
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${t === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
        >
          {t}
        </span>
      ),
    },
    { key: 'amount', label: 'Amount', width: '7.75rem', render: (a) => `₹${(a || 0).toLocaleString()}` },
    { key: 'paymentMethod', label: 'Method', width: '7.5rem' },
    { key: 'source', label: 'Source', width: '7.25rem', render: (s) => s || 'manual' },
    {
      key: 'actions',
      label: 'Actions',
      width: '8rem',
      align: 'center',
      render: (_, row) =>
        row.source === 'manual' ? (
          <button
            onClick={() => {
              setSelected(row);
              setShowDeleteModal(true);
            }}
            className={rowActionClass('danger')}
            aria-label="Delete"
          >
            <FiTrash2 className="h-4 w-4" />
          </button>
        ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mahallu Ledger Items"
        description="Manual journal entries for the Mahallu"
        breadcrumbs={[{ label: 'Mahallu Finance', path: '/mahallu-finance/accounts' }]}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard title="Total Income" value={<>₹{totalIncome.toLocaleString()}</>} tone="success" />
        <StatCard title="Total Expense" value={<>₹{totalExpense.toLocaleString()}</>} tone="destructive" />
        <StatCard
          title="Net Balance"
          value={<>₹{(totalIncome - totalExpense).toLocaleString()}</>}
          tone="info"
        />
      </div>

      <TableCard>
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="w-full sm:w-48">
            <Select
              label="Filter by Ledger"
              options={[
                { value: 'all', label: 'All Ledgers' },
                ...ledgers.map((l) => ({ value: l.id, label: l.name })),
              ]}
              value={ledgerFilter}
              onChange={(e) => {
                setLedgerFilter(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={
            <Button
              onClick={() => navigate(ROUTES.MAHALLU_FINANCE.LEDGER_ITEMS_CREATE)}
              size="sm"
              icon={<FiFileMinus />}
              collapseLabel
            >
              Add Entry
            </Button>
          }
        />
        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <p className="text-center py-8 text-red-600">{error}</p>
        ) : (
          <>
            <Table fixedLayout striped columns={columns} data={filtered} emptyMessage="No entries found" />
            {pagination && (
              <Pagination
                currentPage={currentPage}
                totalPages={pagination.totalPages || 1}
                totalItems={pagination.total || 0}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            )}
          </>
        )}
      </TableCard>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Entry">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Delete entry: <strong>{selected?.description}</strong>?
        </p>
        <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
