import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { formatCurrency } from '@/utils/format';
import { toast } from '@/store/toastStore';
import { qardService } from '@/services/qardService';

interface RepaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  loanId: string;
  outstandingBalance: number;
  onRecorded: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function RepaymentModal({
  isOpen,
  onClose,
  loanId,
  outstandingBalance,
  onRecorded,
}: RepaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(today());
  const [receiptNo, setReceiptNo] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const value = Number(amount);
  // The API rejects an over-payment too; catching it here saves a round trip.
  const tooMuch = value > outstandingBalance;
  const invalid = !(value > 0) || tooMuch;

  const reset = () => {
    setAmount('');
    setPaymentDate(today());
    setReceiptNo('');
    setRemarks('');
    setError(null);
  };

  const submit = async () => {
    if (invalid) return;
    try {
      setSaving(true);
      setError(null);
      await qardService.createRepayment({
        loanId,
        amount: value,
        paymentDate,
        receiptNo: receiptNo || undefined,
        remarks: remarks || undefined,
      });
      toast.success(`Repayment of ${formatCurrency(value)} applied`);
      reset();
      onRecorded();
      onClose();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to record the repayment';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record a repayment"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={invalid || saving}>
            {saving ? 'Saving...' : 'Record'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Outstanding balance:{' '}
          <span className="font-medium text-gray-900 dark:text-gray-100">
            {formatCurrency(outstandingBalance)}
          </span>
          . The amount is applied to the oldest unpaid installments first.
        </p>

        <Input
          label="Amount"
          type="number"
          min={0}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          error={tooMuch ? 'More than the outstanding balance' : undefined}
        />

        <Input
          label="Payment date"
          type="date"
          value={paymentDate}
          onChange={(e) => setPaymentDate(e.target.value)}
        />

        <Input
          label="Receipt number"
          value={receiptNo}
          onChange={(e) => setReceiptNo(e.target.value)}
          placeholder="Optional"
        />

        <Input
          label="Remarks"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          placeholder="Optional"
        />

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
