import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiCreditCard, FiDollarSign, FiRefreshCw, FiDownload, FiFileText, FiFile } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import FilterBar from '@/components/ui/FilterBar';
import Dropdown from '@/components/ui/Dropdown';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { masterAccountService, MasterWallet } from '@/services/masterAccountService';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import StatusBadge from '@/components/ui/StatusBadge';
import { PersonCell } from '@/components/ui/Avatar';

export default function WalletsList() {
  const [searchQuery, setSearchQuery] = useState('');
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
      setError(getFriendlyError(err, "Couldn't load wallets. Refresh the page or try again."));
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
      if (dataToExport.length === 0) { toast.info('Nothing to export. Change your filters and try again.'); return; }
      const filename = 'wallets';
      const title = 'All Wallets';
      switch (type) {
        case 'csv': exportToCSV(columns, dataToExport, filename); break;
        case 'json': exportToJSON(columns, dataToExport, filename); break;
        case 'pdf': exportToPDF(columns, dataToExport, filename, title); break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(getFriendlyError(error, "Couldn't export wallets. Check your connection and try again."));
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<MasterWallet>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'name', label: 'Name', sortable: true, render: (v) => <PersonCell name={v} /> },
    { key: 'type', label: 'Type', render: (t) => (t ? <StatusBadge status={t} tone={t === 'income' ? 'success' : t === 'expense' ? 'danger' : 'neutral'} dot={t === 'income' || t === 'expense'} /> : '-') },
    {
      key: 'balance',
      label: 'Balance',
      render: (balance) => <span className={(balance || 0) < 0 ? 'font-semibold text-[#B3261E] dark:text-red-300' : 'font-semibold text-[#0B4837] dark:text-brand-lime'}>{`₹${balance?.toLocaleString() || 0}`}</span>,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (date) => formatDate(date),
    },
  ];

  const totalBalance = wallets.reduce((sum, w) => sum + (w.balance || 0), 0);

  const stats = [
    { title: 'Total Wallets', value: pagination?.total || wallets.length, icon: <FiCreditCard className="h-[17px] w-[17px]" /> },
    { title: 'Total Balance', value: `₹${totalBalance.toLocaleString()}`, icon: <FiDollarSign className="h-[17px] w-[17px]" />, tone: 'lime' as const, viz: wallets.filter((w) => (w.balance || 0) > 0).length >= 2 ? { type: 'ladder' as const, values: wallets.map((w) => w.balance || 0) } : undefined, summary: `Total balance ₹${totalBalance.toLocaleString()}, wallets ranked` },
  ];

  return (
    <div className="space-y-4">
    <div className="space-y-3">
      <PageHeader title="Master Wallets" description="Manage master wallets"
        actions={
          <Link to="/master-accounts/wallets/create"><Button>+ New wallet</Button></Link>
        }
      />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {stats.map((stat, index) => (
            <StatCard key={index} variant="inline" {...stat} />
          ))}
        </div>
      </div>

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search wallets' }}
          actions={
            <>
              <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={fetchWallets}>
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
        />

        <div className="p-3.5">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-[#B3261E] dark:text-red-300">{error}</p>
              <Button onClick={fetchWallets} className="mt-4" variant="outline">
                Retry
              </Button>
            </div>
          ) : (
            <>
              <Table columns={columns} data={wallets} emptyMessage="No wallets found" showExport={false} />
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
    </div>
  );
}

