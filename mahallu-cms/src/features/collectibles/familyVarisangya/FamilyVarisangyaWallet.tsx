import { useState, useEffect } from 'react';
import ActionsMenu from '@/components/ui/ActionsMenu';
import { FiList } from 'react-icons/fi';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { FiDollarSign, FiCreditCard, FiCheckCircle } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import { PageSkeleton } from '@/components/ui/Skeleton';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn } from '@/types';
import { collectibleService, Wallet } from '@/services/collectibleService';
import { familyService } from '@/services/familyService';
import { formatDate, toTitleCase } from '@/utils/format';
import { ROUTES } from '@/constants/routes';
import { exportToCSV, exportToJSON } from '@/utils/exportUtils';
import { exportInvoicesToPdf, InvoiceDetails } from '@/utils/invoiceUtils';
import { toast } from '@/store/toastStore';
import { loadErrorMessage } from '@/utils/errors';

const FAMILY_BASE = ROUTES.COLLECTIBLES.FAMILY_VARISANGYA.BASE;

export default function FamilyVarisangyaWallet() {
  const navigate = useNavigate();
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
      setError(loadErrorMessage(err, 'wallets'));
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
                  payerName: toTitleCase(wallet.family.houseName) || '-',
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
      toast.error(error?.message || "Couldn't export wallet data");
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<Wallet & { family?: any }>[] = [
    {
      key: 'family',
      label: 'Family',
      width: '7.25rem',
      render: (family) =>
        family ? (
          <Link
            to={ROUTES.FAMILIES.DETAIL(family.id)}
            className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
          >
            {toTitleCase(family.houseName)}
          </Link>
        ) : (
          '-'
        ),
    },
    {
      key: 'balance',
      label: 'Balance',
      width: '9.25rem',
      align: 'center',
      render: (balance) => (
        <span className="font-semibold text-gray-900 dark:text-gray-100">
          ₹{(balance || 0).toLocaleString()}
        </span>
      ),
    },
    {
      key: 'lastTransactionDate',
      label: 'Last Transaction',
      width: '12.25rem',
      render: (date) => (date ? formatDate(date) : '-'),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '8rem',
      align: 'center',
      render: (_, row) => (
        <ActionsMenu
          items={[
            {
              label: 'View transactions',
              icon: <FiList className="h-4 w-4" />,
              onClick: () =>
                navigate(`${FAMILY_BASE}?view=transactions&familyId=${row.family?.id || ''}`),
            },
          ]}
        />
      ),
    },
  ];

  const totalBalance = wallets.reduce((sum, w) => sum + (w.balance || 0), 0);
  const activeWallets = wallets.filter((w) => (w.balance || 0) > 0).length;
  const stats = [
    { title: 'Total Wallets', value: wallets.length, icon: <FiCreditCard className="h-5 w-5" /> },
    { title: 'Active Wallets', value: activeWallets, icon: <FiCheckCircle className="h-5 w-5" /> },
    {
      title: 'Total Balance',
      value: `₹${totalBalance.toLocaleString()}`,
      icon: <FiDollarSign className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Family Varisangya Wallets
          {wallets[0]?.family && ` - ${toTitleCase(wallets[0].family.houseName)}`}
        </h2>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">View wallet balances for families</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
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
        />
        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <EmptyState
            variant="error"
            entity="wallets"
            description={error}
            action={{ label: 'Retry', onClick: fetchWallets }}
          />
        ) : (
          <Table fixedLayout striped columns={columns} data={wallets} emptyMessage="No wallets found" showExport={false} />
        )}
      </TableCard>
    </div>
  );
}
