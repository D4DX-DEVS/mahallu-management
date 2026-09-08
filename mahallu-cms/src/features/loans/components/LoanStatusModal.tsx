import { useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Checkbox from '@/components/ui/Checkbox';
import { formatCurrency } from '@/utils/format';
import { toast } from '@/store/toastStore';
import { qardService, QardLoan, LoanStatus, LOAN_TRANSITIONS } from '@/services/qardService';
import { errorMessage } from '@/utils/errors';

interface LoanStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  loan: QardLoan;
  onUpdated: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

const label = (status: string) => status.replace(/_/g, ' ');

export default function LoanStatusModal({ isOpen, onClose, loan, onUpdated }: LoanStatusModalProps) {
  const options = LOAN_TRANSITIONS[loan.status] || [];
  const [status, setStatus] = useState<LoanStatus | ''>(options[0] ?? '');
  const [approvedAmount, setApprovedAmount] = useState(String(loan.amount));
  const [allowOverApproval, setAllowOverApproval] = useState(false);
  const [disbursedDate, setDisbursedDate] = useState(today());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approving = status === 'approved';
  const disbursing = status === 'disbursed';
  const overApproving = approving && Number(approvedAmount) > loan.amount;

  const submit = async () => {
    if (!status) return;
    try {
      setSaving(true);
      setError(null);
      const payload: Record<string, any> = { status };
      if (approving) {
        payload.approvedAmount = Number(approvedAmount);
        if (allowOverApproval) payload.allowOverApproval = true;
      }
      if (disbursing) payload.disbursedDate = disbursedDate;
      if (notes) payload.notes = notes;

      await qardService.updateLoanStatus(loan.id, payload);
      toast.success(`Loan status updated to ${label(status)}`);
      onUpdated();
      onClose();
    } catch (err: any) {
      const errorMsg = errorMessage(err, { action: 'update the loan' });
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
      title="Move this loan"
      footer={
        <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!status || saving || (overApproving && !allowOverApproval)}>
            {saving ? 'Saving...' : 'Update'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {options.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            A {label(loan.status)} loan cannot be moved any further.
          </p>
        ) : (
          <>
            <Select
              label="New status"
              value={status}
              onChange={(e) => setStatus(e.target.value as LoanStatus)}
              options={options.map((value) => ({ value, label: label(value) }))}
            />

            {approving && (
              <>
                <Input
                  label="Approved amount"
                  type="number"
                  min={0}
                  value={approvedAmount}
                  onChange={(e) => setApprovedAmount(e.target.value)}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Requested: {formatCurrency(loan.amount)}
                </p>
                {overApproving && (
                  <Checkbox
                    label="Approve more than was requested"
                    checked={allowOverApproval}
                    onChange={(e) => setAllowOverApproval(e.target.checked)}
                  />
                )}
              </>
            )}

            {disbursing && (
              <>
                <Input
                  label="Disbursed on"
                  type="date"
                  value={disbursedDate}
                  onChange={(e) => setDisbursedDate(e.target.value)}
                />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  A {loan.repaymentMonths}-month repayment schedule is generated from this date.
                </p>
              </>
            )}

            <Input
              label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
            />
          </>
        )}

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}
