import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiCreditCard, FiDollarSign, FiPlus } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import { PageSkeleton } from '@/components/ui/Skeleton';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { masterAccountService, MasterWallet } from '@/services/masterAccountService';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

export default function WalletsList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [wallets, setWallets] = useState<MasterWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchWallets();
  }, [currentPage]);

  const fetchWallets = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = { page: currentPage, limit: itemsPerPage };
      const result = await masterAccountService.getAllWallets(params);
      setWallets(Array.isArray(result.data) ? result.data : []);
      if (result.pagination) setPagination(result.pagination);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'wallets'));
      console.error('Error fetching wallets:', err);
      setWallets([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      const params = { limit: 10000 };
      const result = await masterAccountService.getAllWallets(params);
      const dataToExport = Array.isArray(result.data) ? result.data : [];
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
          exportToPDF(columns, dataToExport, filename, title);
          break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error?.message || "Couldn't export wallets");
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<MasterWallet>[] = [
    { key: 'name', label: 'Name', width: '6.75rem', sortable: true },
    { key: 'type', label: 'Type', width: '6.25rem' },
    {
      key: 'balance',
      label: 'Balance',
      width: '9.25rem',
      align: 'center',
      render: (balance) => `₹${balance?.toLocaleString() || 0}`,
    },
    {
      key: 'createdAt',
      label: 'Created',
      width: '7.75rem',
      render: (date) => formatDate(date),
    },
  ];

  const totalBalance = wallets.reduce((sum, w) => sum + (w.balance || 0), 0);

  const stats = [
    {
      title: 'Total Wallets',
      value: pagination?.total || wallets.length,
      icon: <FiCreditCard className="h-5 w-5" />,
    },
    {
      title: 'Total Balance',
      value: `₹${totalBalance.toLocaleString()}`,
      icon: <FiDollarSign className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <PageHeader title="Master Wallets" description="Manage master wallets" />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
          isFilterVisible={isFilterVisible}
          hasFilters={false}
          onRefresh={fetchWallets}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={
            <Link to="/master-accounts/wallets/create">
              <Button size="md" icon={<FiPlus />} collapseLabel>New Wallet</Button>
            </Link>
          }
        />
        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchWallets} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <>
            <Table fixedLayout striped columns={columns} data={wallets} emptyMessage="No wallets found" showExport={false} />
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4">
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
      </TableCard>
    </div>
  );
}
