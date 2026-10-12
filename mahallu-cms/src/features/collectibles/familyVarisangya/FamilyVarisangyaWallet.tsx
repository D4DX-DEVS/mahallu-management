import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { FiDollarSign, FiCreditCard, FiCheckCircle, FiRefreshCw, FiDownload, FiFileText, FiFile } from 'react-icons/fi';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import FilterBar from '@/components/ui/FilterBar';
import Dropdown from '@/components/ui/Dropdown';
import { TableColumn } from '@/types';
import { collectibleService, Wallet } from '@/services/collectibleService';
import { familyService } from '@/services/familyService';
import { formatDate } from '@/utils/format';
import { ROUTES } from '@/constants/routes';
import { exportToCSV, exportToJSON } from '@/utils/exportUtils';
import { exportInvoicesToPdf, InvoiceDetails } from '@/utils/invoiceUtils';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { pct } from '@/utils/statSeries';

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
        const familiesResult = await familyService.getAll({ limit: 1000 });
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
      setError(getFriendlyError(err, "Couldn't load wallets. Refresh the page or try again."));
      console.error('Error fetching wallets:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      if (wallets.length === 0) {
        toast.info('Nothing to export. Change your filters and try again.');
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
      toast.error(getFriendlyError(error, "Couldn't export wallet data. Check your connection and try again."));
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
            <PersonCell name={family.houseName} />
          </Link>
        ) : (
          '-'
        ),
    },
    {
      key: 'balance',
      label: 'Balance',
      render: (balance) => (
        <span className="font-semibold text-[#18231E] dark:text-surface-text">
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
      hideable: false,
      render: (_, row) => (
        <RowActions
          onView={() => navigate(`${FAMILY_BASE}?view=transactions&familyId=${row.family?.id || ''}`)}
          viewLabel="View transactions"
        />
      ),
    },
  ];

  const totalBalance = wallets.reduce((sum, w) => sum + (w.balance || 0), 0);
  const activeWallets = wallets.filter((w) => (w.balance || 0) > 0).length;
  const stats = [
    { title: 'Total Wallets', value: wallets.length, icon: <FiCreditCard className="h-[17px] w-[17px]" /> },
    { title: 'Active Wallets', value: activeWallets, icon: <FiCheckCircle className="h-[17px] w-[17px]" />, viz: wallets.length > 0 ? { type: 'ring' as const, percent: pct(activeWallets, wallets.length) } : undefined, summary: `Active wallets ${activeWallets} of ${wallets.length}, ${pct(activeWallets, wallets.length)} percent` },
    { title: 'Total Balance', value: `₹${totalBalance.toLocaleString()}`, icon: <FiDollarSign className="h-[17px] w-[17px]" />, tone: 'lime' as const, viz: activeWallets >= 2 ? { type: 'ladder' as const, values: wallets.map((w) => w.balance || 0) } : undefined, summary: `Total balance ₹${totalBalance.toLocaleString()}, wallets ranked` },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-primary-700 dark:text-surface-text">
          Family Varisangya Wallets
          {wallets[0]?.family && ` - ${wallets[0].family.houseName}`}
        </h2>
        <p className="mt-0.5 text-[12.5px] text-[#7B8983] dark:text-surface-muted">
          View wallet balances for families
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard key={index} variant="inline" {...stat} />
        ))}
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
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchWallets} className="mt-4" variant="secondary">
              Retry
            </Button>
          </div>
        ) : (
          <Table columns={columns} data={wallets} emptyMessage="No wallets found" showExport={false} />
        )}
        </div>
      </Card>
    </div>
  );
}
