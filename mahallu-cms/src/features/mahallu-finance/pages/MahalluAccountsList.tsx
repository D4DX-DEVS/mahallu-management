import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEdit2, FiTrash2, FiBriefcase } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import { PageSkeleton } from '@/components/ui/Skeleton';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { masterAccountService, MahalluAccount } from '@/services/masterAccountService';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { ROUTES } from '@/constants/routes';
import { toast } from '@/store/toastStore';

export default function MahalluAccountsList() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<MahalluAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<MahalluAccount | null>(null);
  const [deleting, setDeleting] = useState(false);
  const itemsPerPage = 10;

  useEffect(() => { fetchAccounts(); }, [currentPage]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await masterAccountService.getAllMahalluAccounts({ page: currentPage, limit: itemsPerPage });
      setAccounts(Array.isArray(result.data) ? result.data : []);
      if (result.pagination) setPagination(result.pagination);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch accounts');
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAccount) return;
    try {
      setDeleting(true);
      await masterAccountService.deleteMahalluAccount(selectedAccount.id);
      setShowDeleteModal(false);
      fetchAccounts();
      toast.success('Account deleted');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      const result = await masterAccountService.getAllMahalluAccounts({ limit: 10000 });
      const data = Array.isArray(result.data) ? result.data : [];
      if (!data.length) { toast.info('No accounts to export'); return; }
      const filename = 'mahallu-accounts';
      if (type === 'csv') exportToCSV(columns, data, filename);
      else if (type === 'json') exportToJSON(columns, data, filename);
      else exportToPDF(columns, data, filename, 'Mahallu Accounts');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to export accounts');
    } finally {
      setIsExporting(false);
    }
  };

  const filteredAccounts = accounts.filter(a =>
    !searchQuery || a.accountName.toLowerCase().includes(searchQuery.toLowerCase()) || (a.bankName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);

  const columns: TableColumn<MahalluAccount>[] = [
    { key: 'id', label: 'No.', render: (_, __, i) => i + 1 },
    { key: 'accountName', label: 'Account Name' },
    { key: 'accountNumber', label: 'Account Number' },
    { key: 'bankName', label: 'Bank Name' },
    { key: 'ifscCode', label: 'IFSC Code' },
    { key: 'balance', label: 'Balance', render: (b) => `₹${(b || 0).toLocaleString()}` },
    { key: 'status', label: 'Status', render: (s) => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>{s}</span>
    )},
    { key: 'createdAt', label: 'Created', render: (d) => formatDate(d) },
    { key: 'actions', label: 'Actions', render: (_, row) => (
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(ROUTES.MAHALLU_FINANCE.ACCOUNTS_EDIT(row.id), { state: { account: row } })} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"><FiEdit2 className="h-4 w-4" /></button>
        <button onClick={() => { setSelectedAccount(row); setShowDeleteModal(true); }} className="p-1.5 rounded-md hover:bg-red-50 text-red-600"><FiTrash2 className="h-4 w-4" /></button>
      </div>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mahallu Bank Accounts</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage the Mahallu's own bank accounts</p>
        </div>
        <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Mahallu Finance', path: '/mahallu-finance/accounts' }, { label: 'Bank Accounts' }]} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-600 dark:text-blue-400">Total Accounts</p>
          <p className="text-2xl font-bold text-blue-700 dark:text-blue-300">{accounts.length}</p>
        </div>
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <p className="text-sm text-green-600 dark:text-green-400">Total Balance</p>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300">₹{totalBalance.toLocaleString()}</p>
        </div>
      </div>

      <Card>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={<Button onClick={() => navigate(ROUTES.MAHALLU_FINANCE.ACCOUNTS_CREATE)} size="sm"><FiBriefcase className="h-4 w-4 mr-2" />Add Account</Button>}
        />
        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <p className="text-center py-8 text-red-600">{error}</p>
        ) : (
          <>
            <Table columns={columns} data={filteredAccounts} emptyMessage="No accounts found" />
            {pagination && <Pagination currentPage={currentPage} totalPages={pagination.totalPages || 1} totalItems={pagination.total || 0} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />}
          </>
        )}
      </Card>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Account">
        <p className="text-gray-600 dark:text-gray-400 mb-6">Are you sure you want to delete <strong>{selectedAccount?.accountName}</strong>?</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</Button>
        </div>
      </Modal>
    </div>
  );
}
