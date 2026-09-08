import { useEffect, useState } from 'react';
import { memberPortalService, PaymentRecord } from '@/services/memberPortalService';
import { downloadPaymentReceiptPdf } from '@/utils/paymentReceiptPdf';
import { useAuthStore } from '@/store/authStore';
import Card from '@/components/ui/Card';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import SortableTh from '@/components/ui/SortableTh';
import { useSortableRows } from '@/hooks/useSortableRows';

type TabType = 'all' | 'varisangya' | 'zakat';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export default function MemberPayments() {
  const user = useAuthStore((state) => state.user);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const result = await memberPortalService.getOwnPayments(undefined, 1, 100);
        setPayments(result.data || []);
      } catch (err: any) {
        setError(loadErrorMessage(err, 'payment records'));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = activeTab === 'all' ? payments : payments.filter((p) => p.type === activeTab);

  const varisangyaTotal = payments.filter((p) => p.type === 'varisangya').reduce((s, p) => s + p.amount, 0);
  const zakatTotal = payments.filter((p) => p.type === 'zakat').reduce((s, p) => s + p.amount, 0);

  const handleDownload = async (payment: PaymentRecord) => {
    setDownloading(payment.id);
    try {
      await downloadPaymentReceiptPdf(payment, user?.name || 'Member');
    } finally {
      setDownloading(null);
    }
  };

  /* Type renders "Varisangya" or "Zakat" from a code, so it sorts on the word
     shown rather than on the code. */
  const {
    rows: sortedPayments,
    sort,
    toggleSort,
  } = useSortableRows(filtered, null, {
    type: (row) => (row.type === 'varisangya' ? 'Varisangya' : 'Zakat'),
  });

  if (loading) {
    return <PageSkeleton />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen-content gap-4">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl w-full mx-auto">
      <PageHeader title="My Payments &amp; Receipts" />
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Varisangya Paid</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-1">
            {currency.format(varisangyaTotal)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {payments.filter((p) => p.type === 'varisangya').length} payments
          </p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500 dark:text-gray-400">Total Zakat Paid</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100 mt-1">
            {currency.format(zakatTotal)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {payments.filter((p) => p.type === 'zakat').length} payments
          </p>
        </Card>
      </div>

      {/* Tab Filter */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        {(['all', 'varisangya', 'zakat'] as TabType[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`pb-2 px-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            {tab === 'all' ? 'All' : tab === 'varisangya' ? 'Varisangya' : 'Zakat'}
          </button>
        ))}
      </div>

      {/* Payments Table */}
      {filtered.length === 0 ? (
        <Card>
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No payment records found.</p>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                  <SortableTh sortKey="receiptNo" sort={sort} onSort={toggleSort} className="py-2 pr-4">
                    Receipt No
                  </SortableTh>
                  <SortableTh sortKey="paymentDate" sort={sort} onSort={toggleSort} className="py-2 pr-4">
                    Date
                  </SortableTh>
                  <SortableTh sortKey="amount" sort={sort} onSort={toggleSort} className="py-2 pr-4">
                    Amount
                  </SortableTh>
                  <SortableTh sortKey="type" sort={sort} onSort={toggleSort} className="py-2 pr-4">
                    Type
                  </SortableTh>
                  <SortableTh sortKey="paymentMethod" sort={sort} onSort={toggleSort} className="py-2 pr-4">
                    Method
                  </SortableTh>
                  <th className="py-2 text-label font-semibold text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedPayments.map((payment) => (
                  <tr
                    key={payment.id}
                    className="border-b border-gray-100 dark:border-gray-900 text-gray-900 dark:text-gray-100"
                  >
                    <td className="py-3 pr-4 font-mono text-xs">{payment.receiptNo || '—'}</td>
                    <td className="py-3 pr-4 text-gray-500 dark:text-gray-400">
                      {payment.paymentDate ? new Date(payment.paymentDate).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="py-3 pr-4 font-semibold">{currency.format(payment.amount)}</td>
                    <td className="py-3 pr-4">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          payment.type === 'varisangya'
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400'
                        }`}
                      >
                        {payment.type === 'varisangya' ? 'Varisangya' : 'Zakat'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 capitalize text-gray-500 dark:text-gray-400">
                      {payment.paymentMethod || '—'}
                    </td>
                    <td className="py-3">
                      <button
                        onClick={() => handleDownload(payment)}
                        disabled={downloading === payment.id}
                        className="text-xs text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50"
                      >
                        {downloading === payment.id ? 'Generating…' : 'Download Receipt'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
