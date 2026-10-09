import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEdit2, FiTrash2, FiPlus } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import ActionsMenu from '@/components/ui/ActionsMenu';
import StatCard from '@/components/ui/StatCard';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Table from '@/components/ui/Table';
import StatusBadge from '@/components/ui/StatusBadge';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { masterAccountService, MahalluAccount, BalanceSummary } from '@/services/masterAccountService';
import { formatDate, formatRupees, toTitleCase } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { ROUTES } from '@/constants/routes';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { fetchAllPages } from '@/services/api';

export default function MahalluAccountsList() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<MahalluAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  /* Total balance across every account (all pages), from the server. */
  const [summary, setSummary] = useState<BalanceSummary>({ totalBalance: 0, count: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<MahalluAccount | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    fetchAccounts();
  }, [currentPage, itemsPerPage]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await masterAccountService.getAllMahalluAccounts({
        page: currentPage,
        limit: itemsPerPage,
      });
      setAccounts(Array.isArray(result.data) ? result.data : []);
      setSummary({
        totalBalance: Number(result.summary?.totalBalance) || 0,
        count: Number(result.summary?.count) || 0,
      });
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
      const allRows = await fetchAllPages((page) => masterAccountService.getAllMahalluAccounts(page));
      const data = Array.isArray(allRows) ? allRows : [];
      if (!data.length) {
        toast.info('No accounts to export');
        return;
      }
      const filename = 'mahallu-accounts';
      if (type === 'csv') exportToCSV(columns, data, filename);
      else if (type === 'json') exportToJSON(columns, data, filename);
      else await exportToPDF(columns, data, filename, 'Mahallu Accounts');
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

  const columns: TableColumn<MahalluAccount>[] = [
    { key: 'accountName', label: 'Account name', sortable: true, width: '14rem', render: (v) => <span className="font-medium text-foreground">{toTitleCase(v)}</span> },
    { key: 'accountNumber', label: 'Account number', priority: 'secondary', width: '12rem' },
    { key: 'bankName', label: 'Bank', sortable: true, priority: 'secondary', width: '10rem', render: (v) => toTitleCase(v) },
    { key: 'ifscCode', label: 'IFSC code', priority: 'tertiary', width: '9rem' },
    { key: 'balance', label: 'Balance', align: 'right', sortable: true, width: '9rem', render: (b) => formatRupees(b) },
    { key: 'status', label: 'Status', sortable: true, width: '8rem', render: (s) => <StatusBadge status={s} /> },
    {
      key: 'actions',
      label: '',
      width: '6.5rem',
      align: 'right',
      sortable: false,
      render: (_, row) => (
        <ActionsMenu
          label={`Actions for ${toTitleCase(row.accountName)}`}
          items={[
            {
              label: 'Edit',
              icon: <FiEdit2 className="h-4 w-4" />,
              onClick: () =>
                navigate(ROUTES.MAHALLU_FINANCE.ACCOUNTS_EDIT(row.id), { state: { account: row } }),
            },
            {
              label: 'Delete',
              icon: <FiTrash2 className="h-4 w-4" />,
              variant: 'danger',
              onClick: () => {
                setSelectedAccount(row);
                setShowDeleteModal(true);
              },
            },
          ]}
        />
      ),
    },
  ];

  const isFiltered = Boolean(searchQuery);

  return (
    <>
      <PageHeader
        title="Mahallu bank accounts"
        description="Manage the mahallu's own bank accounts."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => navigate(ROUTES.MAHALLU_FINANCE.ACCOUNTS_CREATE)}>
            Add account
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 sm:grid-cols-2 gap-3">
        <StatCard title="Total Accounts" value={pagination?.total ?? summary.count} tone="info" />
        <StatCard title="Total Balance" value={formatRupees(summary.totalBalance)} tone="success" />
      </div>

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchEntity="accounts"
          onRefresh={fetchAccounts}
          onExport={handleExport}
          isExporting={isExporting}
        />
        {error ? (
          <EmptyState
            variant="error"
            entity="accounts"
            description={error}
            action={{ label: 'Try again', onClick: fetchAccounts }}
          />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={filteredAccounts}
              isLoading={loading}
              entity="accounts"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); setCurrentPage(1); } }
                  : { label: 'Add account', onClick: () => navigate(ROUTES.MAHALLU_FINANCE.ACCOUNTS_CREATE) }
              }
              onRowClick={(row) => {
                setSelectedAccount(row);
                setShowViewModal(true);
              }}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="accounts"
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(size) => {
                    setItemsPerPage(size);
                    setCurrentPage(1);
                  }}
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
              <p className="text-gray-900 dark:text-gray-100">{formatRupees(selectedAccount.balance)}</p>
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

      <ConfirmDialog
        isOpen={showDeleteModal}
        title={`Delete ${toTitleCase(selectedAccount?.accountName) || 'this account'}?`}
        message="This permanently removes the account and cannot be undone."
        confirmLabel="Delete account"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </>
  );
}
