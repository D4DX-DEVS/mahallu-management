import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiCreditCard, FiDollarSign, FiPlus } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import TableToolbar from '@/components/ui/TableToolbar';
import Modal from '@/components/ui/Modal';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { masterAccountService, MasterWallet, BalanceSummary } from '@/services/masterAccountService';
import { formatDate, toTitleCase } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { fetchAllPages } from '@/services/api';
import { logError } from '@/utils/safeLog';

export default function WalletsList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [wallets, setWallets] = useState<MasterWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  /* Total balance across every wallet (all pages), from the server. */
  const [summary, setSummary] = useState<BalanceSummary>({ totalBalance: 0, count: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<MasterWallet | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchWallets();
  }, [currentPage, itemsPerPage]);

  const fetchWallets = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page: currentPage, limit: itemsPerPage };
      const result = await masterAccountService.getAllWallets(params);
      setWallets(Array.isArray(result.data) ? result.data : []);
      setSummary({
        totalBalance: Number(result.summary?.totalBalance) || 0,
        count: Number(result.summary?.count) || 0,
      });
      if (result.pagination) setPagination(result.pagination);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'wallets'));
      logError('Error fetching wallets', err);
      setWallets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      const dataToExport = await fetchAllPages((page) => masterAccountService.getAllWallets(page));
      if (dataToExport.length === 0) {
        toast.info('No wallets to export');
        return;
      }
      const filename = 'wallets';
      const title = 'All Wallets';
      switch (type) {
        case 'csv':
          exportToCSV(columns, dataToExport, filename);
          break;
        case 'json':
          exportToJSON(columns, dataToExport, filename);
          break;
        case 'pdf':
          await exportToPDF(columns, dataToExport, filename, title);
          break;
      }
    } catch (error: any) {
      logError('Export error', error);
      toast.error(error?.message || "Couldn't export wallets");
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<MasterWallet>[] = [
    { key: 'name', label: 'Name', sortable: true, width: '16rem', render: (v) => <span className="font-medium text-foreground">{toTitleCase(v)}</span> },
    { key: 'type', label: 'Type', sortable: true, width: '10rem', render: (v) => (v ? toTitleCase(v) : '—') },
    { key: 'balance', label: 'Balance', align: 'right', sortable: true, width: '10rem', render: (balance) => `₹${balance?.toLocaleString('en-IN') || 0}` },
    { key: 'createdAt', label: 'Created', sortable: true, priority: 'secondary', width: '9rem', render: (date) => formatDate(date) },
  ];

  const handleDelete = async () => {
    if (!selectedWallet) return;
    try {
      setDeleting(true);
      await masterAccountService.deleteWallet(selectedWallet.id);
      await fetchWallets();
      setShowDeleteModal(false);
      setSelectedWallet(null);
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete wallet' }));
    } finally {
      setDeleting(false);
    }
  };

  // The list endpoint has no `search` query param, so — same as the Mahallu
  // Finance list screens — the search box filters the page already loaded.
  const filteredWallets = wallets.filter(
    (w) => !searchQuery || w.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = [
    {
      title: 'Total Wallets',
      value: pagination?.total || summary.count || wallets.length,
      icon: <FiCreditCard className="h-5 w-5" />,
    },
    {
      title: 'Total Balance',
      value: `₹${summary.totalBalance.toLocaleString()}`,
      icon: <FiDollarSign className="h-5 w-5" />,
    },
  ];

  const isFiltered = Boolean(searchQuery);

  return (
    <>
      <PageHeader
        title="Master wallets"
        description="Manage master wallets."
        actions={
          <Link to="/master-accounts/wallets/create">
            <Button icon={<FiPlus />} collapseLabel>New wallet</Button>
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchEntity="wallets"
          onRefresh={fetchWallets}
          onExport={handleExport}
          isExporting={isExporting}
        />
        {error ? (
          <EmptyState
            variant="error"
            entity="wallets"
            description={error}
            action={{ label: 'Try again', onClick: fetchWallets }}
          />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={filteredWallets}
              isLoading={loading}
              entity="wallets"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); setCurrentPage(1); } }
                  : { label: 'Add wallet', onClick: () => navigate('/master-accounts/wallets/create') }
              }
              onRowClick={(row) => {
                setSelectedWallet(row);
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
                  entity="wallets"
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
          setSelectedWallet(null);
        }}
        title="Wallet Details"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowViewModal(false);
                setSelectedWallet(null);
              }}
            >
              Close
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
        {selectedWallet && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Name</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">{toTitleCase(selectedWallet.name)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Type</p>
              <p className="text-gray-900 dark:text-gray-100 capitalize">{selectedWallet.type || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Balance</p>
              <p className="text-gray-900 dark:text-gray-100">₹{(selectedWallet.balance || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
              <p className="text-gray-900 dark:text-gray-100">{formatDate(selectedWallet.createdAt)}</p>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteModal}
        title={`Delete ${toTitleCase(selectedWallet?.name) || 'this wallet'}?`}
        message="This permanently removes the wallet and cannot be undone."
        confirmLabel="Delete wallet"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setShowDeleteModal(false);
          setSelectedWallet(null);
        }}
      />
    </>
  );
}
