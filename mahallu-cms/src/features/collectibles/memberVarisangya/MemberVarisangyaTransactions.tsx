import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn } from '@/types';
import { collectibleService, Transaction, Wallet, Varisangya } from '@/services/collectibleService';
import { memberService } from '@/services/memberService';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON } from '@/utils/exportUtils';
import { exportInvoicesToPdf, InvoiceDetails } from '@/utils/invoiceUtils';

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

  useEffect(() => {
    if (memberId) {
      fetchData();
    } else {
      fetchAllTransactions();
    }
  }, [memberId]);

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
      setWallet(walletId ? { ...walletData!, id: String(walletId) } as Wallet : null);

      // Always use varisangya records (they have populated member names)
      const varisangyasResult = await collectibleService.getAllVarisangyas({ memberId: memberId || undefined, limit: 10000 });
      const list = varisangyasResult.data || [];
      const mapped = list.map(varisangyaToTransaction).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTransactions(mapped);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch transactions');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllTransactions = async () => {
    try {
      setLoading(true);
      setError(null);
      const varisangyasResult = await collectibleService.getAllVarisangyas({ limit: 10000 });
      const list = varisangyasResult.data || [];
      const mapped = list
        .filter((v) => (v as any).memberId != null)
        .map(varisangyaToTransaction)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTransactions(mapped);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch transactions');
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      if (transactions.length === 0) {
        alert('No data to export');
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
      alert(error?.message || 'Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<Transaction>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    {
      key: 'type',
      label: 'Type',
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
    { key: 'amount', label: 'Amount', render: (amount) => `₹${amount?.toLocaleString() || 0}` },
    { key: 'description', label: 'Description' },
    { key: 'referenceType', label: 'Reference', render: (type) => type || '-' },
    { key: 'createdAt', label: 'Date', render: (date) => formatDate(date) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Member Varisangya Transactions
          {member && ` - ${member.name}`}
        </h2>
        <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
          View all varisangya transactions{member ? ` for ${member.name}` : ''}
        </p>
      </div>

      {wallet && (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Wallet Balance</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
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

      <Card>
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
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={memberId ? fetchData : fetchAllTransactions} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <Table columns={columns} data={transactions} emptyMessage="No transactions found" showExport={false} />
        )}
      </Card>
    </div>
  );
}
