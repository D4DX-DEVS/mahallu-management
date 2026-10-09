import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { FiDollarSign, FiCreditCard, FiCheckCircle } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { collectibleService } from '@/services/collectibleService';
import { memberService } from '@/services/memberService';
import { fetchAllPages } from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate, toTitleCase } from '@/utils/format';
import { ROUTES } from '@/constants/routes';
import { exportToCSV, exportToJSON } from '@/utils/exportUtils';
import { exportInvoicesToPdf, InvoiceDetails } from '@/utils/invoiceUtils';
import { toast } from '@/store/toastStore';
import { loadErrorMessage } from '@/utils/errors';
import {
  EMPTY_WALLET_SUMMARY,
  WALLET_PAGE_SIZE,
  singleWalletRow,
  summarizeWalletRows,
  type WalletListRow,
  type WalletListSummary,
} from '@/utils/walletList';

const MEMBER_BASE = ROUTES.COLLECTIBLES.MEMBER_VARISANGYA.BASE;

export default function MemberVarisangyaWallet() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const memberId = searchParams.get('memberId');

  /* One page of rows from the server: every members (with or without a wallet), not just those with a payment. */
  const [wallets, setWallets] = useState<WalletListRow[]>([]);
  /* Totals over the whole filtered set (all pages), from the server. */
  const [summary, setSummary] = useState<WalletListSummary>(EMPTY_WALLET_SUMMARY);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // A slow response for an old page/search must not overwrite a newer one.
  const latestRequest = useRef(0);

  const debouncedSearch = useDebounce(searchQuery, 500);

  // A page number that only made sense for the previous search must not survive into the new one.
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchWallets();
  }, [memberId, debouncedSearch, currentPage]);

  const fetchWallets = async () => {
    const requestId = ++latestRequest.current;
    try {
      setLoading(true);
      setError(null);
      if (memberId) {
        const [walletData, memberData] = await Promise.all([
          collectibleService.getWallet({ memberId }),
          memberService.getById(memberId),
        ]);
        if (requestId !== latestRequest.current) return;
        const rows = [
          singleWalletRow(
            'member',
            { id: memberId, name: memberData?.name, mahallId: memberData?.mahallId },
            walletData
          ),
        ];
        setWallets(rows);
        setSummary(summarizeWalletRows(rows));
        setPagination(null);
      } else {
        const result = await collectibleService.listWallets('member', {
          page: currentPage,
          limit: WALLET_PAGE_SIZE,
          search: debouncedSearch,
        });
        if (requestId !== latestRequest.current) return;
        setWallets(result.data);
        setSummary(result.summary);
        setPagination(result.pagination);
      }
    } catch (err: any) {
      if (requestId !== latestRequest.current) return;
      setError(loadErrorMessage(err, 'wallets'));
      console.error('Error fetching wallets:', err);
    } finally {
      if (requestId === latestRequest.current) setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      // The export is every row of the list the user is looking at (same search), not just this page.
      const rows = memberId
        ? wallets
        : await fetchAllPages<WalletListRow>((p) =>
            collectibleService.listWallets('member', { ...p, search: debouncedSearch })
          );
      if (rows.length === 0) {
        toast.info('No wallet data to export');
        return;
      }
      const filename = `member-varisangya-wallets${memberId ? `-${memberId}` : ''}`;
      switch (type) {
        case 'csv':
          exportToCSV(columns, rows, filename);
          break;
        case 'json':
          exportToJSON(columns, rows, filename);
          break;
        case 'pdf':
          {
            const invoices: InvoiceDetails[] = rows.map((wallet) => ({
              title: 'Member Varisangya Wallet',
              receiptNo: '-',
              payerLabel: 'Member',
              payerName: toTitleCase(wallet.name) || '-',
              amount: wallet.balance || 0,
              paymentDate: wallet.lastTransactionDate || new Date().toISOString(),
              paymentMethod: '-',
              remarks: `Wallet Balance as of ${formatDate(new Date().toISOString())}`,
            }));
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

  const columns: TableColumn<WalletListRow>[] = [
    {
      key: 'name',
      label: 'Member',
      width: '8rem',
      render: (name, row) =>
        row.memberId ? (
          <Link
            to={ROUTES.MEMBERS.DETAIL(row.memberId)}
            className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
          >
            {toTitleCase(name)}
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
  ];

  const stats = [
    { title: 'Total Wallets', value: summary.count, icon: <FiCreditCard className="h-5 w-5" /> },
    { title: 'Active Wallets', value: summary.activeCount, icon: <FiCheckCircle className="h-5 w-5" /> },
    {
      title: 'Total Balance',
      value: `₹${summary.totalBalance.toLocaleString()}`,
      icon: <FiDollarSign className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Member Varisangya Wallets
          {memberId && wallets[0]?.name && ` - ${toTitleCase(wallets[0].name)}`}
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
          <Table
            fixedLayout
            columns={columns}
            data={wallets}
            isLoading={loading}
            entity="wallets"
            emptyVariant={searchQuery ? 'no-results' : 'empty'}
            rowKey={(row, index) => row.memberId || String(index)}
            onRowClick={(row) => navigate(`${MEMBER_BASE}?view=transactions&memberId=${row.memberId || ''}`)}
          />
        )}

        {pagination && !memberId && (
          <div className="mt-4">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              entity="members"
              onPageChange={(page) => setCurrentPage(page)}
            />
          </div>
        )}
      </TableCard>
    </div>
  );
}
