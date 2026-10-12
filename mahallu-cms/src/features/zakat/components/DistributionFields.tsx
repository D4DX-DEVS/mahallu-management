import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Alert from '@/components/ui/Alert';
import {
  ZakatBeneficiary,
  ZakatFund,
  ASNAF_OPTIONS,
  DISTRIBUTION_TYPE_OPTIONS,
} from '@/services/zakatDistributionService';
import { formatINR } from '@/utils/formatINR';

export interface DistributionForm {
  beneficiaryId: string;
  asnafCategory: string;
  amount: string;
  distributionDate: string;
  type: string;
  paymentMethod: string;
  receiptNo: string;
  remarks: string;
}

export const emptyDistributionForm = (): DistributionForm => ({
  beneficiaryId: '',
  asnafCategory: '',
  amount: '',
  distributionDate: new Date().toISOString().slice(0, 10),
  type: 'regular',
  paymentMethod: 'cash',
  receiptNo: '',
  remarks: '',
});

export const beneficiaryId = (b: { id?: string; _id?: string }) => b.id ?? b._id ?? '';
export const beneficiaryLabel = (b: ZakatBeneficiary) =>
  (b.memberId && typeof b.memberId === 'object' ? b.memberId.name : b.name) || 'Unnamed';

interface Props {
  form: DistributionForm;
  setForm: (f: DistributionForm) => void;
  verified: ZakatBeneficiary[];
  fund: ZakatFund | null;
  errors?: Record<string, string>;
}

/** Shared by the "Record distribution" modal and page. */
export default function DistributionFields({ form, setForm, verified, fund, errors = {} }: Props) {
  const amount = Number(form.amount) || 0;
  const available = fund ? Math.max(fund.available, 0) : null;
  const overFund = available !== null && amount > available;
  const needsApproval = !!fund?.settings.requireApproval && amount > (fund?.settings.approvalThreshold ?? 0);

  const pickBeneficiary = (id: string) => {
    const b = verified.find((x) => beneficiaryId(x) === id);
    const cat = b && b.category && b.category !== 'other' ? b.category : form.asnafCategory;
    setForm({ ...form, beneficiaryId: id, asnafCategory: cat });
  };

  const selected = verified.find((x) => beneficiaryId(x) === form.beneficiaryId);
  const locked = !!selected && selected.category !== 'other';

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Select
        label="Beneficiary"
        value={form.beneficiaryId}
        onChange={(e) => pickBeneficiary(e.target.value)}
        options={[
          { value: '', label: 'Select a verified beneficiary' },
          ...verified.map((b) => ({ value: beneficiaryId(b), label: beneficiaryLabel(b) })),
        ]}
        error={errors.beneficiaryId}
        required
        className="md:col-span-2"
      />

      <Select
        label="Asnaf category"
        value={form.asnafCategory}
        onChange={(e) => setForm({ ...form, asnafCategory: e.target.value })}
        options={[{ value: '', label: 'Choose the category' }, ...ASNAF_OPTIONS]}
        disabled={locked}
        helperText={
          locked
            ? 'Taken from the beneficiary record.'
            : 'Zakat can only be given to one of the eight categories.'
        }
        error={errors.asnafCategory}
        required
      />

      <div>
        <Input
          label="Amount"
          type="number"
          min={0}
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          placeholder="0"
          error={errors.amount || (overFund ? `Only ${formatINR(available ?? 0)} is available in the zakat fund` : undefined)}
          helperText={available !== null ? `Available in the zakat fund: ${formatINR(available)}` : undefined}
          required
        />
      </div>

      <Input
        label="Distribution date"
        type="date"
        value={form.distributionDate}
        onChange={(e) => setForm({ ...form, distributionDate: e.target.value })}
      />

      <Select
        label="Type"
        value={form.type}
        onChange={(e) => setForm({ ...form, type: e.target.value })}
        options={DISTRIBUTION_TYPE_OPTIONS}
      />

      <Input
        label="Receipt no. (optional)"
        value={form.receiptNo}
        onChange={(e) => setForm({ ...form, receiptNo: e.target.value })}
        helperText="A voucher number is added automatically."
      />

      <Input
        label="Remarks"
        value={form.remarks}
        onChange={(e) => setForm({ ...form, remarks: e.target.value })}
        placeholder="Optional notes"
      />

      <div className="md:col-span-2">
        {needsApproval ? (
          <Alert tone="info">
            This will be saved as a proposal. It is paid out and posted to the ledger only after
            {fund && fund.adminCount > 1 ? ' another admin approves it.' : ' it is approved on the Distributions page.'}
          </Alert>
        ) : (
          <Alert tone="info">This distribution is recorded straight away and posted to the ledger as an expense.</Alert>
        )}
      </div>
    </div>
  );
}
