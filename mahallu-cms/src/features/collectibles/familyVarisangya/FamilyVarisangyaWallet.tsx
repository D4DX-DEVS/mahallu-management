import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { FiDollarSign, FiCreditCard, FiCheckCircle } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn } from '@/types';
import { collectibleService, Wallet } from '@/services/collectibleService';
import { familyService } from '@/services/familyService';
import { formatDate } from '@/utils/format';
import { ROUTES } from '@/constants/routes';
import { exportToCSV, exportToJSON } from '@/utils/exportUtils';
import { exportInvoicesToPdf, InvoiceDetails } from '@/utils/invoiceUtils';
import { toast } from '@/store/toastStore';

const FAMILY_BASE = ROUTES.COLLECTIBLES.FAMILY_VARISANGYA.BASE;

export default function FamilyVarisangyaWallet() {
  const [searchParams] = useSearchParams();
  const familyId = searchParams.get('familyId');

  const [wallets, setWallets] = useState<(Wallet & { family?: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);

  useEffect(() => {
    fetchWallets();
  }, [familyId]);

  const fetchWallets = async () => {
    try {
      setLoading(true);
      setError(null);
      if (familyId) {
        const walletData = await collectibleService.getWallet({ familyId });
        const familyData = await familyService.getById(familyId);
        setWallets([{ ...walletData, family: familyData }]);
      } else {
        const familiesResult = await familyService.getAll();
        const families = familiesResult.data;
        const walletsData: (Wallet & { family?: any })[] = [];
        for (const family of families) {
          try {
            const walletData = await collectibleService.getWallet({ familyId: family.id });
            if (walletData && walletData.balance !== undefined) {
              walletsData.push({ ...walletData, family });
            }
          } catch (err) {
            // Skip if wallet doesn't exist
          }
        }
        setWallets(walletsData.sort((a, b) => (b.balance || 0) - (a.balance || 0)));
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch wallets');
      console.error('Error fetching wallets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      if (wallets.length === 0) {
        toast.info('No wallet data to export');
        return;
      }
      const filename = `family-varisangya-wallets${familyId ? `-${familyId}` : ''}`;
      switch (type) {
        case 'csv':
          exportToCSV(columns, wallets, filename);
          break;
        case 'json':
          exportToJSON(columns, wallets, filename);
          break;
        case 'pdf':
          {
            const invoices: InvoiceDetails[] = [];
            for (const wallet of wallets) {
              if (wallet.family) {
                invoices.push({
                  title: 'Family Varisangya Wallet',
                  receiptNo: '-',
                  payerLabel: 'Family',
                  payerName: wallet.family.houseName || '-',
                  amount: wallet.balance || 0,
                  paymentDate: wallet.lastTransactionDate || new Date().toISOString(),
                  paymentMethod: '-',
                  remarks: `Wallet Balance as of ${formatDate(new Date().toISOString())}`,
                });
              }
            }
            await exportInvoicesToPdf(invoices, filename);
          }
          break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error?.message || 'Failed to export wallet data');
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<Wallet & { family?: any }>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    {
      key: 'family',
      label: 'Family',
      render: (family) =>
        family ? (
          <Link
            to={ROUTES.FAMILIES.DETAIL(family.id)}
            className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
          >
            {family.houseName}
          </Link>
        ) : (
          '-'
        ),
    },
    {
      key: 'balance',
      label: 'Balance',
      render: (balance) => (
        <span className="font-semibold text-gray-900 dark:text-gray-100">
          ₹{(balance || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'lastTransactionDate',
      label: 'Last Transaction',
      render: (date) => (date ? formatDate(date) : '-'),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <Link
          to={`${FAMILY_BASE}?view=transactions&familyId=${row.family?.id || ''}`}
          className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
          title="View Transactions"
        >
          View Transactions
        </Link>
      ),
    },
  ];

  const totalBalance = wallets.reduce((sum, w) => sum + (w.balance || 0), 0);
  const activeWallets = wallets.filter((w) => (w.balance || 0) > 0).length;
  const stats = [
    { title: 'Total Wallets', value: wallets.length, icon: <FiCreditCard className="h-5 w-5" /> },
    { title: 'Active Wallets', value: activeWallets, icon: <FiCheckCircle className="h-5 w-5" /> },
    { title: 'Total Balance', value: `₹${totalBalance.toLocaleString()}`, icon: <FiDollarSign className="h-5 w-5" /> },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Family Varisangya Wallets
          {wallets[0]?.family && ` - ${wallets[0].family.houseName}`}
        </h2>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          View wallet balances for families
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>
      <Card>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
          isFilterVisible={isFilterVisible}
          hasFilters={false}
          onRefresh={fetchWallets}
          onExport={handleExport}
          isExporting={isExporting}
        />
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchWallets} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <Table columns={columns} data={wallets} emptyMessage="No wallets found" showExport={false} />
        )}
      </Card>
    </div>
  );
}
