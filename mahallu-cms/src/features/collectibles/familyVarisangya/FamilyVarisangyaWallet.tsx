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
import { familyService } from '@/services/familyService';
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

const FAMILY_BASE = ROUTES.COLLECTIBLES.FAMILY_VARISANGYA.BASE;

export default function FamilyVarisangyaWallet() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const familyId = searchParams.get('familyId');

  /* One page of rows from the server: every families (with or without a wallet), not just those with a payment. */
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
  }, [familyId, debouncedSearch, currentPage]);

  const fetchWallets = async () => {
    const requestId = ++latestRequest.current;
    try {
      setLoading(true);
      setError(null);
      if (familyId) {
        const [walletData, familyData] = await Promise.all([
          collectibleService.getWallet({ familyId }),
          familyService.getById(familyId),
        ]);
        if (requestId !== latestRequest.current) return;
        const rows = [
          singleWalletRow(
            'family',
            { id: familyId, name: familyData?.houseName, mahallId: familyData?.mahallId },
            walletData
          ),
        ];
        setWallets(rows);
        setSummary(summarizeWalletRows(rows));
        setPagination(null);
      } else {
        const result = await collectibleService.listWallets('family', {
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
      const rows = familyId
        ? wallets
        : await fetchAllPages<WalletListRow>((p) =>
            collectibleService.listWallets('family', { ...p, search: debouncedSearch })
          );
      if (rows.length === 0) {
        toast.info('No wallet data to export');
        return;
      }
      const filename = `family-varisangya-wallets${familyId ? `-${familyId}` : ''}`;
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
              title: 'Family Varisangya Wallet',
              receiptNo: '-',
              payerLabel: 'Family',
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
      label: 'Family',
      width: '7.25rem',
      render: (name, row) =>
        row.familyId ? (
          <Link
            to={ROUTES.FAMILIES.DETAIL(row.familyId)}
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
          Family Varisangya Wallets
          {familyId && wallets[0]?.name && ` - ${toTitleCase(wallets[0].name)}`}
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
            rowKey={(row, index) => row.familyId || String(index)}
            onRowClick={(row) => navigate(`${FAMILY_BASE}?view=transactions&familyId=${row.familyId || ''}`)}
          />
        )}

        {pagination && !familyId && (
          <div className="mt-4">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              entity="families"
              onPageChange={(page) => setCurrentPage(page)}
            />
          </div>
        )}
      </TableCard>
    </div>
  );
}
