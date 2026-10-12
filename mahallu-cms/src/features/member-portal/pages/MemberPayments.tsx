import { useEffect, useState } from 'react';
import { formatINR } from '@/utils/formatINR';
import { memberPortalService, PaymentRecord } from '@/services/memberPortalService';
import { downloadPaymentReceiptPdf } from '@/utils/paymentReceiptPdf';
import { useAuthStore } from '@/store/authStore';
import { FiDollarSign, FiHeart, FiDownload } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Tabs from '@/components/ui/Tabs';
import Table from '@/components/ui/Table';
import Badge from '@/components/ui/Badge';
import StatusBadge from '@/components/ui/StatusBadge';
import Alert from '@/components/ui/Alert';
import { TableColumn } from '@/types';
import { monthlySeries } from '@/utils/statSeries';
import RowActions from '@/components/ui/RowActions';
import { getFriendlyError } from '@/utils/apiMessages';

type TabType = 'all' | 'varisangya' | 'zakat';


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
        setError(getFriendlyError(err, "Couldn't load payment records. Refresh the page or try again."));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered =
    activeTab === 'all' ? payments : payments.filter((p) => p.type === activeTab);

  // Pending / rejected requests never count toward totals
  const counted = payments.filter((p) => p.status !== 'pending' && p.status !== 'rejected');
  const varisangyaTotal = counted
    .filter((p) => p.type === 'varisangya')
    .reduce((s, p) => s + p.amount, 0);
  const zakatTotal = counted
    .filter((p) => p.type === 'zakat')
    .reduce((s, p) => s + p.amount, 0);

  const varisangyaSeries = monthlySeries(counted.filter((p) => p.type === 'varisangya'), (p) => p.paymentDate, (p) => p.amount);
  const zakatSeries = monthlySeries(counted.filter((p) => p.type === 'zakat'), (p) => p.paymentDate, (p) => p.amount);

  const handleDownload = async (payment: PaymentRecord) => {
    setDownloading(payment.id);
    try {
      await downloadPaymentReceiptPdf(payment, user?.name || 'Member');
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-140px)]">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6">
        <Alert tone="danger">{error}</Alert>
      </div>
    );
  }

  const columns: TableColumn<PaymentRecord>[] = [
    {
      key: 'receiptNo',
      label: 'Receipt No',
      render: (v) => <span className="font-mono text-xs">{v || '—'}</span>,
    },
    {
      key: 'paymentDate',
      label: 'Date',
      render: (v) => (v ? new Date(v).toLocaleDateString('en-IN') : '—'),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (v) => <span className="font-semibold text-[#0B4837] dark:text-brand-lime">{formatINR(v)}</span>,
    },
    {
      key: 'type',
      label: 'Type',
      render: (v) => <Badge variant={v === 'varisangya' ? 'primary' : 'warning'}>{v === 'varisangya' ? 'Varisangya' : 'Zakat'}</Badge>,
    },
    {
      key: 'paymentMethod',
      label: 'Method',
      render: (v) => (v ? <StatusBadge status={v} tone="neutral" dot={false} /> : '—'),
    },
    {
      key: 'status',
      label: 'Status',
      render: (s, payment) =>
        s === 'pending' ? (
          <StatusBadge status="pending" label="Pending approval" />
        ) : s === 'rejected' ? (
          <span title={payment.rejectReason || undefined}>
            <StatusBadge status="rejected" />
          </span>
        ) : (
          <StatusBadge status="paid" />
        ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, payment) => (
        <RowActions
          extra={[
            {
              label: 'Download receipt',
              icon: <FiDownload />,
              onClick: () => handleDownload(payment),
              disabledReason:
                payment.status === 'pending' ? 'Receipt after approval'
                : payment.status === 'rejected' ? 'No receipt for a rejected payment'
                : downloading === payment.id ? 'Generating…' : undefined,
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="My payments & receipts" description="Varisangya and zakat payments with downloadable receipts" />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          variant="inline"
          title="Total Varisangya Paid"
          value={formatINR(varisangyaTotal)}
          icon={<FiDollarSign className="h-[17px] w-[17px]" />}
          tone="green"
          viz={varisangyaSeries.length ? { type: 'area', values: varisangyaSeries } : undefined}
        />
        <StatCard
          variant="inline"
          title="Total Zakat Paid"
          value={formatINR(zakatTotal)}
          icon={<FiHeart className="h-[17px] w-[17px]" />}
          tone="lime"
          viz={zakatSeries.length ? { type: 'bars', values: zakatSeries, color: '#E0B400' } : undefined}
        />
      </div>

      <Card padding="none">
        <div className="px-4 pt-3">
          <Tabs
            aria-label="Payment type"
            value={activeTab}
            onChange={(v) => setActiveTab(v as TabType)}
            tabs={[
              { value: 'all', label: 'All', count: payments.length },
              { value: 'varisangya', label: 'Varisangya', count: payments.filter((p) => p.type === 'varisangya').length },
              { value: 'zakat', label: 'Zakat', count: payments.filter((p) => p.type === 'zakat').length },
            ]}
          />
        </div>
        <div className="p-3.5">
          <Table columns={columns} data={filtered} showExport={false} emptyMessage="No payment records found." />
        </div>
      </Card>
    </div>
  );
}
