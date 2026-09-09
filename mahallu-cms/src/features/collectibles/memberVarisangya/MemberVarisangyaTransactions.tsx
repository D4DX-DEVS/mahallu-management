import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '@/components/ui/Card';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { collectibleService, Transaction, Wallet, Varisangya } from '@/services/collectibleService';
import { memberService } from '@/services/memberService';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON } from '@/utils/exportUtils';
import { exportInvoicesToPdf, InvoiceDetails } from '@/utils/invoiceUtils';
import { toast } from '@/store/toastStore';
import { loadErrorMessage } from '@/utils/errors';

/** Map varisangya payment to transaction-like shape for the table (list shows varisangya, so transactions view must match). */
function varisangyaToTransaction(v: Varisangya): Transaction {
  const id = (v as any).id ?? (v as any)._id;
  const memberName = v.memberId && typeof v.memberId === 'object' ? v.memberId.name : undefined;
  const payerInfo = memberName ? ` - ${memberName}` : '';
  return {
    id: id != null ? String(id) : '',
    walletId: '',
    type: 'credit',
    amount: v.amount ?? 0,
    description: v.remarks || `Varisangya payment${payerInfo} - ${v.receiptNo || 'N/A'}`,
    referenceId: v.receiptNo,
    referenceType: 'varisangya',
    createdAt: v.paymentDate || v.createdAt || new Date().toISOString(),
  };
}

export default function MemberVarisangyaTransactions() {
  const [searchParams] = useSearchParams();
  const memberId = searchParams.get('memberId');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Switching member invalidates the current page offset
  useEffect(() => {
    setCurrentPage(1);
  }, [memberId]);

  useEffect(() => {
    if (memberId) {
      fetchData();
    } else {
      fetchAllTransactions();
    }
  }, [memberId, currentPage, itemsPerPage]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      if (memberId) {
        const memberData = await memberService.getById(memberId);
        setMember(memberData);
      }
      const walletData = await collectibleService.getWallet({ memberId: memberId || undefined });
      const walletId = walletData && ((walletData as any).id ?? (walletData as any)._id);
      setWallet(walletId ? ({ ...walletData!, id: String(walletId) } as Wallet) : null);

      // Always use varisangya records (they have populated member names).
      // The API already sorts by paymentDate desc, so no client-side re-sort.
      const varisangyasResult = await collectibleService.getAllVarisangyas({
        memberId: memberId || undefined,
        page: currentPage,
        limit: itemsPerPage,
      });
      setTransactions((varisangyasResult.data || []).map(varisangyaToTransaction));
      setPagination(varisangyasResult.pagination);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'transactions'));
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      // hasMember filters server-side; filtering after paging would short the page
      const varisangyasResult = await collectibleService.getAllVarisangyas({
        hasMember: true,
        page: currentPage,
        limit: itemsPerPage,
      });
      setTransactions((varisangyasResult.data || []).map(varisangyaToTransaction));
      setPagination(varisangyasResult.pagination);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'transactions'));
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      // Export the whole result set, not just the page on screen
      const allResult = await collectibleService.getAllVarisangyas({
        memberId: memberId || undefined,
        hasMember: memberId ? undefined : true,
        limit: 10000,
      });
      const transactions = (allResult.data || []).map(varisangyaToTransaction);
      if (transactions.length === 0) {
        toast.info('No transaction data to export');
        return;
      }
      const filename = `member-varisangya-transactions${memberId ? `-${memberId}` : ''}`;
      switch (type) {
        case 'csv':
          exportToCSV(columns, transactions, filename);
          break;
        case 'json':
          exportToJSON(columns, transactions, filename);
          break;
        case 'pdf':
          {
            const invoices: InvoiceDetails[] = transactions
              .filter((t) => t.type === 'credit' && t.referenceType === 'varisangya')
              .map((t) => ({
                title: 'Member Varisangya Transaction',
                receiptNo: t.referenceId || '-',
                payerLabel: 'Member',
                payerName: member?.name || '-',
                amount: t.amount,
                paymentDate: t.createdAt,
                paymentMethod: '-',
                remarks: t.description,
              }));
            await exportInvoicesToPdf(invoices, filename);
          }
          break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error?.message || "Couldn't export transactions");
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<Transaction>[] = [
    { key: 'id', label: 'No.', width: '6rem', render: (_, __, index) => (currentPage - 1) * itemsPerPage + index + 1 },
    {
      key: 'type',
      label: 'Type',
      width: '6.25rem',
      render: (type) => (
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            type === 'credit'
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
          }`}
        >
          {type}
        </span>
      ),
    },
    { key: 'amount', label: 'Amount', width: '7.75rem', render: (amount) => `₹${amount?.toLocaleString() || 0}` },
    { key: 'description', label: 'Description', width: '9.25rem' },
    { key: 'referenceType', label: 'Reference', width: '8.75rem', render: (type) => type || '-' },
    { key: 'createdAt', label: 'Date', width: '6.25rem', render: (date) => formatDate(date) },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Member Varisangya Transactions
          {member && <span className="capitalize"> - {member.name}</span>}
        </h2>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          View all varisangya transactions
          {member ? <span className="capitalize"> for {member.name}</span> : ''}
        </p>
      </div>

      {wallet && (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Wallet Balance</p>
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                ₹{(wallet?.balance ?? 0).toLocaleString()}
              </p>
            </div>
            {wallet?.lastTransactionDate && (
              <div className="text-right">
                <p className="text-sm text-gray-500 dark:text-gray-400">Last Transaction</p>
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {formatDate(wallet.lastTransactionDate)}
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
          isFilterVisible={isFilterVisible}
          hasFilters={false}
          onRefresh={memberId ? fetchData : fetchAllTransactions}
          onExport={handleExport}
          isExporting={isExporting}
        />
        {error ? (
          <div className="text-center py-10">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={memberId ? fetchData : fetchAllTransactions} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <>
            <Table
              fixedLayout
              striped
              columns={columns}
              data={transactions}
              isLoading={loading}
              emptyMessage="No transactions found"
              showExport={false}
            />
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(items) => {
                    setItemsPerPage(items);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
          </>
        )}
      </TableCard>
    </div>
  );
}
