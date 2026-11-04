import { useCallback, useEffect, useState } from 'react';
import { memberPortalService, PaymentRecord } from '@/services/memberPortalService';
import { fetchAllPages } from '@/services/api';
import { downloadPaymentReceiptPdf } from '@/utils/paymentReceiptPdf';
import { useAuthStore } from '@/store/authStore';
import StatCard from '@/components/ui/StatCard';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import Table from '@/components/ui/Table';
import Tabs from '@/components/ui/Tabs';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { TableColumn } from '@/types';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

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

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Every payment, so the Varisangya / Zakat totals below are not just the first 100 rows.
      const all = await fetchAllPages<PaymentRecord>((p) => memberPortalService.getOwnPayments(undefined, p.page, p.limit));
      setPayments(all);
    } catch (err) {
      setError(loadErrorMessage(err, 'payment records'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

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

  const columns: TableColumn<PaymentRecord>[] = [
    {
      key: 'receiptNo',
      label: 'Receipt no.',
      sortable: true,
      width: '14rem',
      render: (v) => <span className="font-medium text-foreground tabular-nums">{v || '—'}</span>,
    },
    {
      key: 'paymentDate',
      label: 'Date',
      sortable: true,
      width: '10rem',
      render: (v) => (v ? new Date(v).toLocaleDateString('en-IN') : '—'),
    },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      sortable: true,
      width: '10rem',
      render: (v) => <span className="font-semibold tabular-nums">{currency.format(v)}</span>,
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      width: '9rem',
      render: (v) => <Badge variant={v === 'varisangya' ? 'info' : 'primary'}>{v === 'varisangya' ? 'Varisangya' : 'Zakat'}</Badge>,
    },
    {
      key: 'paymentMethod',
      label: 'Method',
      sortable: true,
      priority: 'secondary',
      width: '9rem',
      render: (v) => <span className="capitalize">{v || '—'}</span>,
    },
    {
      key: 'receipt',
      label: 'Receipt',
      sortable: false,
      width: '11rem',
      render: (_v, payment) => (
        <button
          type="button"
          onClick={() => handleDownload(payment)}
          disabled={downloading === payment.id}
          className="text-xs font-medium text-primary hover:underline disabled:opacity-50"
        >
          {downloading === payment.id ? 'Generating…' : 'Download receipt'}
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader title="My payments & receipts" description="Varisangya and zakat you have paid, with downloadable receipts." />

      <div className="mb-6 grid grid-cols-2 gap-3">
        <StatCard
          title="Total varisangya paid"
          value={currency.format(varisangyaTotal)}
          hint={<>{payments.filter((p) => p.type === 'varisangya').length} payments</>}
        />
        <StatCard
          title="Total zakat paid"
          value={currency.format(zakatTotal)}
          hint={<>{payments.filter((p) => p.type === 'zakat').length} payments</>}
        />
      </div>

      <TableCard>
        <TableToolbar
          tabs={
            <Tabs
              variant="segmented"
              ariaLabel="Payment type"
              value={activeTab}
              onChange={(value) => setActiveTab(value as TabType)}
              items={[
                { value: 'all', label: 'All' },
                { value: 'varisangya', label: 'Varisangya' },
                { value: 'zakat', label: 'Zakat' },
              ]}
            />
          }
          onRefresh={load}
        />

        {error ? (
          <EmptyState variant="error" entity="payments" description={error} action={{ label: 'Try again', onClick: load }} />
        ) : (
          <Table
            fixedLayout
            columns={columns}
            data={filtered}
            isLoading={loading}
            entity="payments"
            emptyVariant={activeTab === 'all' ? 'empty' : 'no-results'}
            emptyAction={activeTab === 'all' ? undefined : { label: 'Show all payments', onClick: () => setActiveTab('all') }}
            rowKey={(payment, index) => payment.id || String(index)}
          />
        )}
      </TableCard>
    </>
  );
}
