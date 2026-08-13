import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiX, FiList, FiTrendingUp, FiTrendingDown, FiEdit2, FiTrash2 } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { masterAccountService, LedgerItem, Ledger } from '@/services/masterAccountService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';

export default function LedgerItemsList() {
  const { currentInstituteId: userInstituteId } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
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
      setError(err.response?.data?.message || 'Failed to fetch ledger items');
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
        toast.info('No ledger items to export');
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
      toast.error(error?.message || 'Failed to export ledger items');
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
      render: (type) => (
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            type === 'income'
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          }`}
        >
          {type}
        </span>
      ),
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
      render: (source: string) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
          source === 'manual' || !source
            ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
        }`}>
          {source || 'manual'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => {
        const isAuto = row.source && row.source !== 'manual';
        return (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => !isAuto && openEditModal(row)}
              className={`p-1.5 rounded-md ${isAuto ? 'opacity-30 cursor-not-allowed' : 'hover:bg-gray-100 dark:hover:bg-gray-700'} text-gray-600 dark:text-gray-400`}
              title={isAuto ? 'Auto-posted entries cannot be edited' : 'Edit'}
              disabled={isAuto}
            >
              <FiEdit2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => { if (!isAuto) { setSelectedItem(row); setShowDeleteModal(true); } }}
              className={`p-1.5 rounded-md ${isAuto ? 'opacity-30 cursor-not-allowed' : 'hover:bg-red-50 dark:hover:bg-red-900/20'} text-red-600 dark:text-red-400`}
              title={isAuto ? 'Auto-posted entries cannot be deleted' : 'Delete'}
              disabled={isAuto}
            >
              <FiTrash2 className="h-4 w-4" />
            </button>
          </div>
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
      setError(err.response?.data?.message || 'Failed to update ledger item');
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
      setError(err.response?.data?.message || 'Failed to delete ledger item');
    } finally {
      setDeleting(false);
    }
  };

  const totalIncome = items.filter((i) => i.type === 'income').reduce((sum, i) => sum + (i.amount || 0), 0);
  const totalExpense = items.filter((i) => i.type === 'expense').reduce((sum, i) => sum + (i.amount || 0), 0);

  const stats = [
    { title: 'Total Items', value: pagination?.total || items.length, icon: <FiList className="h-5 w-5" /> },
    { title: 'Total Income', value: `₹${totalIncome.toLocaleString()}`, icon: <FiTrendingUp className="h-5 w-5" /> },
    { title: 'Total Expense', value: `₹${totalExpense.toLocaleString()}`, icon: <FiTrendingDown className="h-5 w-5" /> },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Ledger Items</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Manage ledger transactions</p>
          </div>
          <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Ledger Items' }]} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      <Card>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
          isFilterVisible={isFilterVisible}
          hasFilters={true}
          onRefresh={fetchItems}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={
            <Link to="/master-accounts/ledger-items/create">
              <Button size="md">
                + New Item
              </Button>
            </Link>
          }
        />

        {isFilterVisible && (
          <div className="relative flex flex-wrap items-center gap-4 mb-6 p-4 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700">
            <button
              onClick={() => setIsFilterVisible(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <FiX className="h-4 w-4" />
            </button>
            <div className="w-64">
              <Select
                label="Ledger"
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
                  label="Institute"
                  options={[
                    { value: 'all', label: 'All Institutes' },
                    ...institutes.map(i => ({ value: i.id, label: i.name })),
                  ]}
                  value={instituteFilter}
                  onChange={(e) => setInstituteFilter(e.target.value)}
                />
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchItems} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <>
            <Table columns={columns} data={items} emptyMessage="No ledger items found" showExport={false} />
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-6">
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
        title="Delete Ledger Item"
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowDeleteModal(false); setSelectedItem(null); }}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleting}>Delete</Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          Are you sure you want to delete this ledger item (<strong>₹{selectedItem?.amount?.toLocaleString()}</strong> - {selectedItem?.description})? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

