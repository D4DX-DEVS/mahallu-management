import { useCallback, useEffect, useState } from 'react';
import { FiCheck, FiX, FiClock, FiRefreshCw, FiCheckCircle } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import Tabs from '@/components/ui/Tabs';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import { controlClasses, labelClasses } from '@/components/ui/Input';
import { TableColumn } from '@/types';
import {
  collectibleService,
  PaymentRequest,
  PaymentRequestStatus,
  PaymentRequestSummary,
} from '@/services/collectibleService';
import { formatDate } from '@/utils/format';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const EMPTY_SUMMARY: PaymentRequestSummary = {
  pending: { count: 0, amount: 0 },
  approved: { count: 0, amount: 0 },
  rejected: { count: 0, amount: 0 },
};

const rowKey = (r: PaymentRequest) => `${r.type}:${r.id}`;
const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

export default function PaymentApprovals() {
  const [tab, setTab] = useState<PaymentRequestStatus>('pending');
  const [rows, setRows] = useState<PaymentRequest[]>([]);
  const [summary, setSummary] = useState<PaymentRequestSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [rejecting, setRejecting] = useState<PaymentRequest | null>(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await collectibleService.getPaymentRequests({ status: tab });
      setRows(res.data);
      setSummary(res.summary || EMPTY_SUMMARY);
      setSelected([]);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load payment requests. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  const approve = async (r: PaymentRequest) => {
    setBusyKey(rowKey(r));
    try {
      await collectibleService.approvePaymentRequest(r.type, r.id);
      toast.success(`Approved ${money(r.amount)} from ${r.payerName}`);
      await load();
    } catch (err: any) {
      toast.error(getFriendlyError(err, 'Failed to approve. Try again in a moment.'));
    } finally {
      setBusyKey(null);
    }
  };

  const bulkApprove = async (keys: string[]) => {
    const targets = rows.filter((r) => keys.includes(rowKey(r)));
    if (targets.length === 0) return;
    setBulkBusy(true);
    // sequential: receipt numbers are allocated per approval
    let ok = 0;
    let failed = 0;
    for (const r of targets) {
      try {
        await collectibleService.approvePaymentRequest(r.type, r.id);
        ok += 1;
      } catch {
        failed += 1;
      }
    }
    setBulkBusy(false);
    if (ok) toast.success(`Approved ${ok} payment${ok === 1 ? '' : 's'}`);
    if (failed) toast.error(`${failed} could not be approved`);
    await load();
  };

  const confirmReject = async () => {
    if (!rejecting) return;
    const text = reason.trim();
    if (!text) return;
    setBusyKey(rowKey(rejecting));
    try {
      await collectibleService.rejectPaymentRequest(rejecting.type, rejecting.id, text);
      toast.success('Payment request rejected');
      setRejecting(null);
      setReason('');
      await load();
    } catch (err: any) {
      toast.error(getFriendlyError(err, 'Failed to reject. Try again in a moment.'));
    } finally {
      setBusyKey(null);
    }
  };

  const columns: TableColumn<PaymentRequest>[] = [
    { key: 'payerName', label: 'Payer', sortable: true, render: (v) => <PersonCell name={v} /> },
    {
      key: 'type',
      label: 'Type',
      render: (t, r) => (
        <span className="inline-flex items-center gap-1.5">
          <StatusBadge status={t} tone="neutral" dot={false} />
          {r.category ? <StatusBadge status={r.category} tone="info" dot={false} /> : null}
        </span>
      ),
    },
    { key: 'amount', label: 'Amount', align: 'right', render: (a) => <span className="font-semibold">{money(a)}</span> },
    { key: 'paymentDate', label: 'Payment date', render: (d) => formatDate(d) },
    { key: 'paymentMethod', label: 'Method', render: (m) => (m ? <StatusBadge status={m} tone="neutral" dot={false} /> : '-') },
    { key: 'createdAt', label: 'Requested', render: (d) => formatDate(d) },
    { key: 'status', label: 'Status', render: (s) => <StatusBadge status={s} /> },
    ...(tab === 'approved'
      ? [{ key: 'receiptNo', label: 'Receipt No.', render: (v: string) => v || '-' } as TableColumn<PaymentRequest>]
      : []),
    ...(tab === 'rejected'
      ? [{ key: 'rejectReason', label: 'Reason', render: (v: string) => v || '-' } as TableColumn<PaymentRequest>]
      : []),
    ...(tab === 'pending'
      ? [
          {
            key: 'actions',
            label: 'Actions',
            align: 'right',
            hideable: false,
            render: (_: any, r: PaymentRequest) => {
              const busy = busyKey === rowKey(r);
              return (
                <RowActions
                  extra={[
                    { label: 'Approve', icon: <FiCheck />, onClick: () => approve(r), disabledReason: busy || bulkBusy ? 'Please wait' : undefined },
                  ]}
                  onDelete={() => {
                    setReason('');
                    setRejecting(r);
                  }}
                  deleteLabel="Reject"
                  deleteIcon={<FiX />}
                  disabledReason={{ delete: busy || bulkBusy ? 'Please wait' : undefined }}
                />
              );
            },
          } as TableColumn<PaymentRequest>,
        ]
      : []),
  ];

  const emptyCopy: Record<PaymentRequestStatus, { title: string; description: string }> = {
    pending: { title: 'No pending requests', description: 'Payments submitted by members will appear here for review.' },
    approved: { title: 'No approved requests yet', description: 'Approved member payments are listed here with their receipt numbers.' },
    rejected: { title: 'No rejected requests', description: 'Requests you reject are kept here with the reason given.' },
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payment approvals"
        description="Review Varisangya and Zakat payments submitted by members. Only approved payments count in totals and receipts."
        actions={
          <Button variant="secondary" iconOnly aria-label="Refresh" onClick={load}>
            <FiRefreshCw className="h-3.5 w-3.5" />
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard variant="inline" tone="gold" title="Pending requests" value={summary.pending.count} viz={summary.pending.count > 0 ? { type: 'dots', count: summary.pending.count } : undefined} summary={`${summary.pending.count} payment requests pending`} icon={<FiClock className="h-[17px] w-[17px]" />} />
        <StatCard variant="inline" tone="gold" title="Pending amount" value={money(summary.pending.amount)} icon={<FiClock className="h-[17px] w-[17px]" />} />
        <StatCard variant="inline" title="Approved (member)" value={summary.approved.count} viz={summary.pending.count + summary.approved.count + summary.rejected.count > 0 ? { type: 'segments', segments: [{ value: summary.approved.count }, { value: summary.pending.count, color: '#FDD817' }, { value: summary.rejected.count, color: '#B3261E' }] } : undefined} summary={`Approved ${summary.approved.count}, pending ${summary.pending.count}, rejected ${summary.rejected.count}`} icon={<FiCheckCircle className="h-[17px] w-[17px]" />} />
      </div>

      <Card padding="none" className="overflow-visible">
        <div className="px-3.5 pt-2.5">
          <Tabs
            aria-label="Payment request status"
            value={tab}
            onChange={(v) => setTab(v)}
            tabs={[
              { value: 'pending', label: 'Pending', count: summary.pending.count },
              { value: 'approved', label: 'Approved', count: summary.approved.count },
              { value: 'rejected', label: 'Rejected', count: summary.rejected.count },
            ]}
          />
        </div>
        <div className="p-3.5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <Button onClick={load} className="mt-4" variant="secondary">
                Retry
              </Button>
            </div>
          ) : rows.length === 0 ? (
            <EmptyState {...emptyCopy[tab]} />
          ) : (
            <Table
              columns={columns}
              data={rows}
              showExport={false}
              selectable={tab === 'pending'}
              getRowId={(r) => rowKey(r)}
              selectedIds={selected}
              onSelectionChange={setSelected}
              bulkActions={(ids) => (
                <Button size="sm" onClick={() => bulkApprove(ids)} isLoading={bulkBusy}>
                  <FiCheck className="h-3.5 w-3.5" /> Approve {ids.length}
                </Button>
              )}
            />
          )}
        </div>
      </Card>

      <Modal
        isOpen={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Reject payment request?"
        description={rejecting ? `${rejecting.payerName} · ${money(rejecting.amount)} (${rejecting.type})` : undefined}
        size="sm"
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button variant="danger-solid" onClick={confirmReject} disabled={!reason.trim() || busyKey !== null}>
              Reject request
            </Button>
          </div>
        }
      >
        <label htmlFor="reject-reason" className={labelClasses}>
          Reason (shown to the member)
        </label>
        <textarea
          id="reject-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Payment not received"
          className={`${controlClasses} py-2`}
        />
      </Modal>
    </div>
  );
}
