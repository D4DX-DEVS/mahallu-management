import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBriefcase, FiDownload, FiFileText, FiFile, FiDollarSign } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import RowActions from '@/components/ui/RowActions';
import Alert from '@/components/ui/Alert';
import StatusBadge from '@/components/ui/StatusBadge';
import StatCard from '@/components/ui/StatCard';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import FilterBar from '@/components/ui/FilterBar';
import Dropdown from '@/components/ui/Dropdown';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { masterAccountService, MahalluAccount } from '@/services/masterAccountService';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { ROUTES } from '@/constants/routes';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { PersonCell } from '@/components/ui/Avatar';

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
      setError(getFriendlyError(err, "Couldn't load accounts. Refresh the page or try again."));
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
      toast.error(getFriendlyError(err, "Couldn't delete account. Try again in a moment."));
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      const result = await masterAccountService.getAllMahalluAccounts({ limit: 10000 });
      const data = Array.isArray(result.data) ? result.data : [];
      if (!data.length) { toast.info('Nothing to export. Change your filters and try again.'); return; }
      const filename = 'mahallu-accounts';
      if (type === 'csv') exportToCSV(columns, data, filename);
      else if (type === 'json') exportToJSON(columns, data, filename);
      else exportToPDF(columns, data, filename, 'Mahallu Accounts');
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't export accounts. Check your connection and try again."));
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
    { key: 'accountName', label: 'Account Name', render: (v, row) => <PersonCell name={v} subtitle={row.bankName} /> },
    { key: 'accountNumber', label: 'Account Number' },
    { key: 'bankName', label: 'Bank Name' },
    { key: 'ifscCode', label: 'IFSC Code' },
    { key: 'balance', label: 'Balance', render: (b) => <span className={(b || 0) < 0 ? 'font-semibold text-[#B3261E] dark:text-red-300' : 'font-semibold text-[#0B4837] dark:text-brand-lime'}>{`₹${(b || 0).toLocaleString()}`}</span> },
    { key: 'status', label: 'Status', render: (s) => (
      <StatusBadge status={s} />
    )},
    { key: 'createdAt', label: 'Created', render: (d) => formatDate(d) },
    { key: 'actions', label: 'Actions', render: (_, row) => (
      <RowActions
        onEdit={() => navigate(ROUTES.MAHALLU_FINANCE.ACCOUNTS_EDIT(row.id), { state: { account: row } })}
        onDelete={() => { setSelectedAccount(row); setShowDeleteModal(true); }}
        ariaLabels={{ edit: 'Edit', delete: 'Delete' }}
      />
    )},
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Mahallu Bank Accounts" description="Manage the Mahallu's own bank accounts"
        actions={
          <Button onClick={() => navigate(ROUTES.MAHALLU_FINANCE.ACCOUNTS_CREATE)}><FiBriefcase className="h-3.5 w-3.5" />Add Account</Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard variant="inline" title="Total Accounts" value={accounts.length} tone="neutral" />
        <StatCard variant="inline" viz={accounts.filter((a: any) => (a.balance || 0) > 0).length >= 2 ? { type: 'ladder', values: accounts.map((a: any) => a.balance || 0), color: '#04563A' } : undefined} summary={`Total balance ₹${totalBalance.toLocaleString()}, accounts ranked`} title="Total Balance" value={`₹${totalBalance.toLocaleString()}`} tone="green" icon={<FiDollarSign className="h-[17px] w-[17px]" />} />
      </div>

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search accounts' }}
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
          {loading ? (
            <div className="flex justify-center py-12"><LoadingSpinner /></div>
          ) : error ? (
            <Alert tone="danger">{error}</Alert>
          ) : (
            <>
              <Table columns={columns} data={filteredAccounts} emptyMessage="No accounts found" />
              {pagination && <Pagination currentPage={currentPage} totalPages={pagination.totalPages || 1} totalItems={pagination.total || 0} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />}
            </>
          )}
      
        </div>
      </Card>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete account?">
        <p className="text-[#5B6963] dark:text-surface-muted mb-6">Delete <strong>{selectedAccount?.accountName}</strong>?</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button variant="danger-solid" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</Button>
        </div>
      </Modal>
    </div>
  );
}
