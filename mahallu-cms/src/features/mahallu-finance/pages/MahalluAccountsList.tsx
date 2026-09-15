import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBriefcase } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import StatCard from '@/components/ui/StatCard';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import { PageSkeleton } from '@/components/ui/Skeleton';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { masterAccountService, MahalluAccount } from '@/services/masterAccountService';
import { formatDate, toTitleCase } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { ROUTES } from '@/constants/routes';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

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
  const [showViewModal, setShowViewModal] = useState(false);
  const itemsPerPage = 10;

  useEffect(() => {
    fetchAccounts();
  }, [currentPage]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await masterAccountService.getAllMahalluAccounts({
        page: currentPage,
        limit: itemsPerPage,
      });
      setAccounts(Array.isArray(result.data) ? result.data : []);
      if (result.pagination) setPagination(result.pagination);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'accounts'));
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
      toast.error(errorMessage(err, { action: 'delete account' }));
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      const result = await masterAccountService.getAllMahalluAccounts({ limit: 10000 });
      const data = Array.isArray(result.data) ? result.data : [];
      if (!data.length) {
        toast.info('No accounts to export');
        return;
      }
      const filename = 'mahallu-accounts';
      if (type === 'csv') exportToCSV(columns, data, filename);
      else if (type === 'json') exportToJSON(columns, data, filename);
      else exportToPDF(columns, data, filename, 'Mahallu Accounts');
    } catch (err: any) {
      toast.error(err?.message || "Couldn't export accounts");
    } finally {
      setIsExporting(false);
    }
  };

  const filteredAccounts = accounts.filter(
    (a) =>
      !searchQuery ||
      a.accountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.bankName || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);

  const columns: TableColumn<MahalluAccount>[] = [
    { key: 'id', label: 'No.', width: '6rem', render: (_, __, i) => i + 1 },
    { key: 'accountName', label: 'Account Name', width: '10.75rem', render: (v) => toTitleCase(v) },
    { key: 'accountNumber', label: 'Account Number', width: '11.75rem' },
    { key: 'bankName', label: 'Bank Name', width: '9.25rem', render: (v) => toTitleCase(v) },
    { key: 'ifscCode', label: 'IFSC Code', width: '9.25rem' },
    { key: 'balance', label: 'Balance', width: '7.5rem', render: (b) => `₹${(b || 0).toLocaleString()}` },
    {
      key: 'status',
      label: 'Status',
      width: '7.25rem',
      render: (s) => (
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${s === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}
        >
          {s}
        </span>
      ),
    },
    { key: 'createdAt', label: 'Created', width: '7.75rem', render: (d) => formatDate(d) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mahallu Bank Accounts"
        description="Manage the Mahallu's own bank accounts"
        breadcrumbs={[{ label: 'Mahallu Finance', path: '/mahallu-finance/accounts' }]}
      />

      <div className="grid grid-cols-2 sm:grid-cols-2 gap-3">
        <StatCard title="Total Accounts" value={accounts.length} tone="info" />
        <StatCard title="Total Balance" value={<>₹{totalBalance.toLocaleString()}</>} tone="success" />
      </div>

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={
            <Button
              onClick={() => navigate(ROUTES.MAHALLU_FINANCE.ACCOUNTS_CREATE)}
              size="sm"
              icon={<FiBriefcase />}
              collapseLabel
            >
              Add Account
            </Button>
          }
        />
        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <p className="text-center py-8 text-red-600">{error}</p>
        ) : (
          <>
            <Table
              fixedLayout
              striped
              columns={columns}
              data={filteredAccounts}
              emptyMessage="No accounts found"
              onRowClick={(row) => {
                setSelectedAccount(row);
                setShowViewModal(true);
              }}
            />
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

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedAccount(null);
        }}
        title="Account Details"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowViewModal(false);
                setSelectedAccount(null);
              }}
            >
              Close
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (selectedAccount) {
                  navigate(ROUTES.MAHALLU_FINANCE.ACCOUNTS_EDIT(selectedAccount.id), {
                    state: { account: selectedAccount },
                  });
                }
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
        {selectedAccount && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Account Name</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">{toTitleCase(selectedAccount.accountName)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Account Number</p>
              <p className="text-gray-900 dark:text-gray-100">{selectedAccount.accountNumber}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Bank Name</p>
              <p className="text-gray-900 dark:text-gray-100">{toTitleCase(selectedAccount.bankName)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">IFSC Code</p>
              <p className="text-gray-900 dark:text-gray-100">{selectedAccount.ifscCode}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Balance</p>
              <p className="text-gray-900 dark:text-gray-100">₹{(selectedAccount.balance || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
              <p className="text-gray-900 dark:text-gray-100 capitalize">{selectedAccount.status}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
              <p className="text-gray-900 dark:text-gray-100">{formatDate(selectedAccount.createdAt)}</p>
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Account">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Are you sure you want to delete <strong>{toTitleCase(selectedAccount?.accountName)}</strong>?
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
