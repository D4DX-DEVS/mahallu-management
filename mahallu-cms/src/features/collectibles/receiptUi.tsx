import { useState, useEffect } from 'react';
import { FiPrinter, FiSlash, FiEdit2 } from 'react-icons/fi';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import StatusBadge from '@/components/ui/StatusBadge';
import DetailModal, { DetailSection, DetailField, DetailList } from '@/components/ui/DetailModal';
import { useAuthStore } from '@/store/authStore';
import { formatDate, formatDateTime } from '@/utils/format';
import { ReceiptAuditFields } from '@/services/collectibleService';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

export const MIN_CANCEL_REASON = 5;

export const isCancelled = (row: ReceiptAuditFields) => row.status === 'cancelled';

/** Mirrors the API: mahall admins may cancel by default; an explicit per-user flag wins. Delete is super admin only. */
export function useReceiptPermissions() {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const explicit = user?.permissions?.canCancelReceipts;
  const canCancel = isSuperAdmin || (typeof explicit === 'boolean' ? explicit : user?.role === 'mahall');
  return { canCancel, canHardDelete: isSuperAdmin };
}

const userName = (u: ReceiptAuditFields['cancelledBy']) =>
  u && typeof u === 'object' ? u.name || 'a team member' : 'a team member';

/** Active receipts show a green badge; cancelled ones show red, with the reason on hover. */
export function ReceiptStatusBadge({ row }: { row: ReceiptAuditFields }) {
  if (!isCancelled(row)) return <StatusBadge status="approved" label="Active" />;
  const tip = `${row.cancelReason || 'Cancelled'}${row.cancelledAt ? ` (${formatDate(row.cancelledAt)}, by ${userName(row.cancelledBy)})` : ''}`;
  return <StatusBadge status="cancelled" label="Cancelled" title={tip} />;
}

interface CancelDialogProps {
  isOpen: boolean;
  receiptNo?: string;
  payer?: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

/** ConfirmDialog-style dialog with the required reason field (ConfirmDialog itself has no input slot). */
export function CancelReceiptDialog({ isOpen, receiptNo, payer, onClose, onConfirm }: CancelDialogProps) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setReason('');
      setError(null);
      setBusy(false);
    }
  }, [isOpen]);

  const valid = reason.trim().length >= MIN_CANCEL_REASON;

  const submit = async () => {
    if (!valid) {
      setError(`Please write at least ${MIN_CANCEL_REASON} characters so the reason makes sense later.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(reason.trim());
    } catch (err: any) {
      toast.error(getFriendlyError(err, 'The receipt could not be cancelled. Nothing was changed, please try again.'));
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={busy ? () => undefined : onClose}
      title={`Cancel receipt${receiptNo ? ` ${receiptNo}` : ''}?`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Keep receipt
          </Button>
          <Button variant="danger-solid" onClick={submit} isLoading={busy} disabled={!valid}>
            Cancel receipt
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {payer && <p className="text-[13px] text-[#3A4741] dark:text-surface-text">Receipt for {payer}.</p>}
        <Alert tone="warning">This keeps the receipt number and reverses the amounts. It cannot be undone.</Alert>
        <label className="block">
          <span className="mb-1 block text-[12px] font-bold text-[#3A4741] dark:text-surface-text">
            Reason (required)
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            maxLength={300}
            autoFocus
            placeholder="For example: wrong family selected, amount entered twice"
            className="w-full rounded-xl border border-line-strong bg-white px-3 py-2 text-[13px] text-[#18231E] focus:outline-none focus:ring-4 focus:ring-brand-lime/[.28] dark:border-surface-border-strong dark:bg-surface-raised dark:text-surface-text"
          />
        </label>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Modal>
  );
}

const FIELD_LABEL: Record<string, string> = {
  amount: 'Amount',
  paymentDate: 'Payment date',
  paymentMethod: 'Payment method',
  remarks: 'Remarks',
  remarksMl: 'Remarks (Malayalam)',
  payerName: 'Payer name',
  payerId: 'Payer',
  category: 'Category',
};

const fmtValue = (field: string, v: unknown) => {
  if (v === null || v === undefined || v === '') return 'empty';
  if (field === 'paymentDate') return formatDate(String(v));
  if (field === 'amount') return `₹${Number(v).toLocaleString('en-IN')}`;
  return String(v);
};

/** "Edit history" list: who changed what, newest first. */
export function EditHistorySection({ row }: { row: ReceiptAuditFields }) {
  const entries = [...(row.editHistory || [])].reverse();
  return (
    <DetailList
      title="Edit history"
      emptyText="This receipt has not been edited."
      items={entries.map((e, i) => ({
        id: `${e.at}-${i}`,
        primary: Object.entries(e.changes || {})
          .map(([f, c]) => `${FIELD_LABEL[f] || f}: ${fmtValue(f, c.from)} to ${fmtValue(f, c.to)}`)
          .join(' · '),
        secondary: `${formatDateTime(e.at)} by ${userName(e.by)}`,
      }))}
    />
  );
}

interface ReceiptDetailProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  row: (ReceiptAuditFields & { receiptNo?: string; amount: number; paymentDate: string; paymentMethod?: string; remarks?: string }) | null;
  fields?: Array<{ label: string; value?: string }>;
  canEdit?: boolean;
  onEdit?: () => void;
  onReprint: () => void;
  onCancel: () => void;
}

/** Quick details for a receipt: numbers, status, audit trail and the Reprint / Cancel actions. */
export function ReceiptDetailModal({ isOpen, onClose, title, row, fields = [], canEdit, onEdit, onReprint, onCancel }: ReceiptDetailProps) {
  const { canCancel } = useReceiptPermissions();
  if (!row) return null;
  const cancelled = isCancelled(row);
  const prints = row.printLog || [];
  const dupCount = prints.filter((p) => p.kind === 'duplicate').length;

  return (
    <DetailModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      subtitle={`Receipt ${row.receiptNo || '-'}`}
      badges={<ReceiptStatusBadge row={row} />}
      primaryAction={
        <div className="flex items-center gap-2">
          {!cancelled && canEdit && onEdit && (
            <Button variant="secondary" onClick={onEdit}>
              <FiEdit2 className="h-3.5 w-3.5" /> Edit
            </Button>
          )}
          {!cancelled && (
            <Button variant="secondary" onClick={onReprint}>
              <FiPrinter className="h-3.5 w-3.5" /> Reprint (duplicate)
            </Button>
          )}
          {!cancelled && canCancel && (
            <Button variant="danger" onClick={onCancel}>
              <FiSlash className="h-3.5 w-3.5" /> Cancel receipt
            </Button>
          )}
        </div>
      }
    >
      {cancelled && (
        <Alert tone="danger" title="This receipt is cancelled" className="mb-4">
          {row.cancelReason}
          {row.cancelledAt ? ` (${formatDateTime(row.cancelledAt)} by ${userName(row.cancelledBy)})` : ''}. Its number is kept and the
          amounts are reversed. To record the payment again, create a new receipt.
        </Alert>
      )}
      <DetailSection title="Receipt">
        <DetailField label="Receipt no." value={row.receiptNo} copy />
        <DetailField label="Amount" value={`₹${(row.amount || 0).toLocaleString('en-IN')}`} />
        <DetailField label="Payment date" value={row.paymentDate ? formatDate(row.paymentDate) : undefined} />
        <DetailField label="Payment method" value={row.paymentMethod} />
        {fields.map((f) => (
          <DetailField key={f.label} label={f.label} value={f.value} />
        ))}
        <DetailField label="Remarks" value={row.remarks} wide />
      </DetailSection>
      <EditHistorySection row={row} />
      <DetailSection title="Prints" columns={1}>
        <DetailField
          label="Print log"
          value={prints.length ? `${prints.length} ${prints.length === 1 ? 'print' : 'prints'}, ${dupCount} marked duplicate. Last: ${formatDateTime(prints[prints.length - 1].at)}` : 'Not printed yet'}
        />
      </DetailSection>
    </DetailModal>
  );
}
