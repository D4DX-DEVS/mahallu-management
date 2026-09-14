import { useState, useEffect } from 'react';
import ActionsMenu from '@/components/ui/ActionsMenu';
import { FiList } from 'react-icons/fi';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { FiDollarSign, FiCreditCard, FiCheckCircle } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import { PageSkeleton } from '@/components/ui/Skeleton';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn } from '@/types';
import { collectibleService, Wallet } from '@/services/collectibleService';
import { memberService } from '@/services/memberService';
import { formatDate, toTitleCase } from '@/utils/format';
import { ROUTES } from '@/constants/routes';
import { exportToCSV, exportToJSON } from '@/utils/exportUtils';
import { exportInvoicesToPdf, InvoiceDetails } from '@/utils/invoiceUtils';
import { toast } from '@/store/toastStore';
import { loadErrorMessage } from '@/utils/errors';

const MEMBER_BASE = ROUTES.COLLECTIBLES.MEMBER_VARISANGYA.BASE;

export default function MemberVarisangyaWallet() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const memberId = searchParams.get('memberId');

  const [wallets, setWallets] = useState<(Wallet & { member?: any })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);

  useEffect(() => {
    fetchWallets();
  }, [memberId]);

  const fetchWallets = async () => {
    try {
      setLoading(true);
      setError(null);
      if (memberId) {
        const walletData = await collectibleService.getWallet({ memberId });
        const memberData = await memberService.getById(memberId);
        setWallets([{ ...walletData, member: memberData }]);
      } else {
        const membersResult = await memberService.getAll();
        const members = membersResult.data;
        const walletsData: (Wallet & { member?: any })[] = [];
        for (const member of members) {
          try {
            const walletData = await collectibleService.getWallet({ memberId: member.id });
            if (walletData && walletData.balance !== undefined) {
              walletsData.push({ ...walletData, member });
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
      const filename = `member-varisangya-wallets${memberId ? `-${memberId}` : ''}`;
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
              if (wallet.member) {
                invoices.push({
                  title: 'Member Varisangya Wallet',
                  receiptNo: '-',
                  payerLabel: 'Member',
                  payerName: toTitleCase(wallet.member.name) || '-',
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

  const columns: TableColumn<Wallet & { member?: any }>[] = [
    {
      key: 'member',
      label: 'Member',
      width: '8rem',
      render: (member) =>
        member ? (
          <Link
            to={ROUTES.MEMBERS.DETAIL(member.id)}
            className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
          >
            {toTitleCase(member.name)}
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
                navigate(`${MEMBER_BASE}?view=transactions&memberId=${row.member?.id || ''}`),
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
          Member Varisangya Wallets
          {wallets[0]?.member && <span> - {toTitleCase(wallets[0].member.name)}</span>}
        </h2>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">View wallet balances for members</p>
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
          <div className="text-center py-10">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchWallets} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <Table fixedLayout striped columns={columns} data={wallets} emptyMessage="No wallets found" showExport={false} />
        )}
      </TableCard>
    </div>
  );
}
