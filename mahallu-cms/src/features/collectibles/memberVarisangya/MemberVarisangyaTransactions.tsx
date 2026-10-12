import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { FiRefreshCw, FiDownload, FiFileText, FiFile } from 'react-icons/fi';
import StatusBadge from '@/components/ui/StatusBadge';
import Avatar from '@/components/ui/Avatar';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import FilterBar from '@/components/ui/FilterBar';
import Dropdown from '@/components/ui/Dropdown';
import { TableColumn } from '@/types';
import { collectibleService, Transaction, Wallet, Varisangya } from '@/services/collectibleService';
import { memberService } from '@/services/memberService';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON } from '@/utils/exportUtils';
import { exportInvoicesToPdf, InvoiceDetails } from '@/utils/invoiceUtils';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

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
      setError(getFriendlyError(err, "Couldn't load transactions. Refresh the page or try again."));
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
      setError(getFriendlyError(err, "Couldn't load transactions. Refresh the page or try again."));
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      if (transactions.length === 0) {
        toast.info('Nothing to export. Change your filters and try again.');
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
      toast.error(getFriendlyError(error, "Couldn't export transactions. Check your connection and try again."));
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<Transaction>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    {
      key: 'type',
      label: 'Type',
      render: (type) => <StatusBadge status={type} tone={type === 'credit' ? 'success' : 'danger'} />,
    },
    { key: 'amount', label: 'Amount', render: (amount) => `₹${amount?.toLocaleString() || 0}` },
    { key: 'description', label: 'Description' },
    { key: 'referenceType', label: 'Reference', render: (type) => type || '-' },
    { key: 'createdAt', label: 'Date', render: (date) => formatDate(date) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        {member && <Avatar size={40} name={member.name} src={member.photoUrl} />}
        <div className="min-w-0">
        <h2 className="text-base font-bold text-primary-700 dark:text-surface-text">
          Member Varisangya Transactions
          {member && ` - ${member.name}`}
        </h2>
        <p className="mt-0.5 text-[12.5px] text-[#7B8983] dark:text-surface-muted">
          View all varisangya transactions{member ? ` for ${member.name}` : ''}
        </p>
        </div>
      </div>

      {wallet && (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#7B8983] dark:text-surface-muted">Wallet Balance</p>
              <p className="text-2xl font-bold text-[#18231E] dark:text-surface-text">
                ₹{(wallet?.balance ?? 0).toLocaleString()}
              </p>
            </div>
            {wallet?.lastTransactionDate && (
              <div className="text-right">
                <p className="text-xs text-[#7B8983] dark:text-surface-muted">Last Transaction</p>
                <p className="text-sm font-medium text-[#18231E] dark:text-surface-text">
                  {formatDate(wallet.lastTransactionDate)}
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search transactions' }}
          actions={
            <>
              <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={memberId ? fetchData : fetchAllTransactions}>
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
            <Button onClick={memberId ? fetchData : fetchAllTransactions} className="mt-4" variant="secondary">
              Retry
            </Button>
          </div>
        ) : (
          <Table columns={columns} data={transactions} emptyMessage="No transactions found" showExport={false} />
        )}
        </div>
      </Card>
    </div>
  );
}
