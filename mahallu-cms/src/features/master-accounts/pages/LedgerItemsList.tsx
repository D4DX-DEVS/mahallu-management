import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiList, FiTrendingUp, FiTrendingDown, FiRefreshCw, FiDownload, FiFileText, FiFile } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import RowActions from '@/components/ui/RowActions';
import Badge from '@/components/ui/Badge';
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
import { masterAccountService, LedgerItem, Ledger } from '@/services/masterAccountService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { monthlySeries } from '@/utils/statSeries';

export default function LedgerItemsList() {
  const { currentInstituteId: userInstituteId } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [ledgerFilter, setLedgerFilter] = useState('all');
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LedgerItem | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editForm, setEditForm] = useState({ date: '', amount: 0, type: 'income' as 'income' | 'expense', description: '', paymentMethod: '', referenceNo: '' });
  const [institutes, setInstitutes] = useState<{ id: string; name: string }[]>([]);
  const [instituteFilter, setInstituteFilter] = useState(userInstituteId || 'all');

  useEffect(() => {
    fetchLedgers();
    if (!userInstituteId) {
      instituteService.getAll({ limit: 1000 }).then(r => setInstitutes(r.data.map((i: any) => ({ id: i.id, name: i.name })))).catch(() => {});
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [ledgerFilter, currentPage, instituteFilter]);

  const fetchLedgers = async () => {
    try {
      // Fetch all ledgers for dropdown (no pagination needed for filter)
      const result = await masterAccountService.getAllLedgers({ limit: 1000 });
      setLedgers(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      console.error('Error fetching ledgers:', err);
      setLedgers([]);
    }
  };

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
      };
      if (ledgerFilter !== 'all') {
        params.ledgerId = ledgerFilter;
      }
      if (instituteFilter !== 'all') {
        params.instituteId = instituteFilter;
      }
      const result = await masterAccountService.getLedgerItems(params);
      setItems(Array.isArray(result.data) ? result.data : []);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load ledger items. Refresh the page or try again."));
      console.error('Error fetching items:', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);

      const params: any = { limit: 10000 };
      if (ledgerFilter !== 'all') params.ledgerId = ledgerFilter;

      const result = await masterAccountService.getLedgerItems(params);
      const dataToExport = Array.isArray(result.data) ? result.data : [];

      if (dataToExport.length === 0) {
        toast.info('Nothing to export. Change your filters and try again.');
        return;
      }

      const filename = 'ledger-items';
      const title = 'Ledger Items';

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
      toast.error(getFriendlyError(error, "Couldn't export ledger items. Check your connection and try again."));
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<LedgerItem>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    {
      key: 'date',
      label: 'Date',
      render: (date) => formatDate(date),
    },
    {
      key: 'type',
      label: 'Type',
      render: (type) => <Badge variant={type === 'income' ? 'success' : 'danger'} dot className="capitalize">{type}</Badge>,
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (amount) => `₹${amount?.toLocaleString() || 0}`,
    },
    { key: 'description', label: 'Description' },
    {
      key: 'source' as any,
      label: 'Source',
      render: (source: string) => <Badge variant={source === 'manual' || !source ? 'neutral' : 'info'}>{source || 'manual'}</Badge>,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => {
        const isAuto = row.source && row.source !== 'manual';
        return (
          <RowActions
            onEdit={() => openEditModal(row)}
            onDelete={() => { setSelectedItem(row); setShowDeleteModal(true); }}
            disabledReason={isAuto ? { edit: 'Auto-posted entries cannot be edited', delete: 'Auto-posted entries cannot be deleted' } : undefined}
            ariaLabels={{ edit: 'Edit', delete: 'Delete' }}
          />
        );
      },
    },
  ];

  const openEditModal = (item: LedgerItem) => {
    setSelectedItem(item);
    setEditForm({
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : '',
      amount: item.amount || 0,
      type: item.type || 'income',
      description: item.description || '',
      paymentMethod: (item as any).paymentMethod || '',
      referenceNo: (item as any).referenceNo || '',
    });
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!selectedItem) return;
    try {
      await masterAccountService.updateLedgerItem(selectedItem.id, {
        ...editForm,
        amount: Number(editForm.amount),
      });
      await fetchItems();
      setShowEditModal(false);
      setSelectedItem(null);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't update ledger item. Try again in a moment."));
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    try {
      setDeleting(true);
      await masterAccountService.deleteLedgerItem(selectedItem.id);
      await fetchItems();
      setShowDeleteModal(false);
      setSelectedItem(null);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't delete ledger item. Try again in a moment."));
    } finally {
      setDeleting(false);
    }
  };

  const totalIncome = items.filter((i) => i.type === 'income').reduce((sum, i) => sum + (i.amount || 0), 0);
  const totalExpense = items.filter((i) => i.type === 'expense').reduce((sum, i) => sum + (i.amount || 0), 0);

  const incomeSeries = monthlySeries(items.filter((i) => i.type === 'income'), (i) => i.date || i.createdAt, (i) => i.amount);
  const expenseSeries = monthlySeries(items.filter((i) => i.type === 'expense'), (i) => i.date || i.createdAt, (i) => i.amount);
  const stats = [
    { title: 'Total Items', value: pagination?.total || items.length, icon: <FiList className="h-[17px] w-[17px]" /> },
    { title: 'Total Income', value: `₹${totalIncome.toLocaleString()}`, icon: <FiTrendingUp className="h-[17px] w-[17px]" />, tone: 'lime' as const, viz: incomeSeries.length ? { type: 'area' as const, values: incomeSeries } : undefined },
    { title: 'Total Expense', value: `₹${totalExpense.toLocaleString()}`, icon: <FiTrendingDown className="h-[17px] w-[17px]" />, tone: 'gold' as const, viz: expenseSeries.length ? { type: 'step' as const, values: expenseSeries } : undefined },
  ];

  return (
    <div className="space-y-4">
    <div className="space-y-3">
      <PageHeader title="Ledger Items" description="Manage ledger transactions"
        actions={
          <Link to="/master-accounts/ledger-items/create">
            <Button>
              + New item
            </Button>
          </Link>
        }
      />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <StatCard key={index} variant="inline" {...stat} />
          ))}
        </div>
      </div>

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search ledger items' }}
          actions={
            <>
              <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={fetchItems}>
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
          <div className="w-64">
            <Select
              options={[
                { value: 'all', label: 'All Ledgers' },
                ...ledgers.map((l) => ({ value: l.id, label: l.name })),
              ]}
              value={ledgerFilter}
              onChange={(e) => setLedgerFilter(e.target.value)}
            />
          </div>
          {!userInstituteId && (
            <div className="w-64">
              <Select
                options={[
                  { value: 'all', label: 'All Institutes' },
                  ...institutes.map(i => ({ value: i.id, label: i.name })),
                ]}
                value={instituteFilter}
                onChange={(e) => setInstituteFilter(e.target.value)}
              />
            </div>
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
              <Button onClick={fetchItems} className="mt-4" variant="outline">
                Retry
              </Button>
            </div>
          ) : (
            <>
              <Table columns={columns} data={items} emptyMessage="No ledger items found" showExport={false} />
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
        onClose={() => { setShowEditModal(false); setSelectedItem(null); }}
        title="Edit Ledger Item"
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowEditModal(false); setSelectedItem(null); }}>Cancel</Button>
            <Button onClick={handleEdit}>Save Changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Date" type="date" value={editForm.date} onChange={(e) => setEditForm({ ...editForm, date: e.target.value })} />
          <Select label="Type" value={editForm.type} onChange={(e) => setEditForm({ ...editForm, type: e.target.value as 'income' | 'expense' })} options={[{ value: 'income', label: 'Income' }, { value: 'expense', label: 'Expense' }]} />
          <Input label="Amount" type="number" step="0.01" value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: parseFloat(e.target.value) || 0 })} />
          <Input label="Description" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
          <Input label="Payment Method" value={editForm.paymentMethod} onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })} />
          <Input label="Reference No" value={editForm.referenceNo} onChange={(e) => setEditForm({ ...editForm, referenceNo: e.target.value })} />
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setSelectedItem(null); }}
        title="Delete ledger item?"
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowDeleteModal(false); setSelectedItem(null); }}>Cancel</Button>
            <Button variant="danger-solid" onClick={handleDelete} isLoading={deleting}>Delete</Button>
          </>
        }
      >
        <p className="text-[13px] text-[#5B6963] dark:text-surface-muted">
          Delete this ledger item (<strong>₹{selectedItem?.amount?.toLocaleString()}</strong> - {selectedItem?.description})? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

