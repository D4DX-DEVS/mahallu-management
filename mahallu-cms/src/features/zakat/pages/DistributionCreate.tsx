import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Checkbox from '@/components/ui/Checkbox';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { toast } from '@/store/toastStore';
import {
  zakatDistributionService,
  ZakatBeneficiary,
  DISTRIBUTION_TYPE_OPTIONS,
} from '@/services/zakatDistributionService';
import { fetchAllPages } from '@/services/api';
import { FiArrowLeft } from 'react-icons/fi';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { useFormValidation } from '@/hooks/useFormValidation';
import { FieldRule, LIMITS } from '@/utils/validation';
import { toTitleCase } from '@/utils/format';

/**
 * The same limits the API applies, so a form that passes here is not
 * refused there. Required matches what each input already declares.
 */
const RULES: Record<string, FieldRule> = {
  beneficiaryId: { label: 'beneficiary', required: true, type: 'id' },
  amount: { label: 'amount', required: true, type: 'number', min: 1, max: LIMITS.amount.max },
  distributionDate: { label: 'distribution date', type: 'date' },
  type: { label: 'type', maxLength: LIMITS.shortText.max },
  paymentMethod: { label: 'payment method', maxLength: LIMITS.shortText.max },
  receiptNo: { label: 'receipt number', maxLength: LIMITS.shortText.max },
  remarks: { label: 'remarks', maxLength: LIMITS.notes.max },
};

export default function DistributionCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [verified, setVerified] = useState<ZakatBeneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    beneficiaryId: '',
    amount: '',
    distributionDate: new Date().toISOString().slice(0, 10),
    type: 'regular',
    paymentMethod: 'cash',
    receiptNo: '',
    remarks: '',
    postToLedger: false,
  });
  const { errors, validate, setErrors } = useFormValidation(RULES);

  useEffect(() => {
    // Only verified beneficiaries can be paid. /zakat/beneficiaries caps limit at
    // 100 and 400s above it, so the old limit:200 request always failed and
    // left this picker empty.
    fetchAllPages<ZakatBeneficiary>((p) =>
      zakatDistributionService.getBeneficiaries({ verificationStatus: 'verified', status: 'active', ...p })
    )
      .then((rows) => setVerified(rows))
      .catch((err) => {
        setVerified([]);
        toast.error(loadErrorMessage(err, 'beneficiaries'));
      })
      .finally(() => setLoading(false));
  }, []);

  // Preselect beneficiary from state if provided
  useEffect(() => {
    const state = location.state as { beneficiaryId?: string } | null;
    if (state?.beneficiaryId) {
      setForm((prev) => ({ ...prev, beneficiaryId: state.beneficiaryId }));
    }
  }, [location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Every field checked at once, each message on its own field.
    if (!validate(form)) return;
    try {
      setSaving(true);
      const amount = Number(form.amount);
      await zakatDistributionService.createDistribution({
        ...form,
        amount,
        distributionDate: form.distributionDate || undefined,
      });
      toast.success(`Distribution recorded`);
      navigate('/zakat/distributions');
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'record distribution' }));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Record Zakat Distribution"
        description="Register a payment to a verified beneficiary"
        breadcrumbs={[
          { label: 'Zakat', path: '/zakat' },
          { label: 'Distributions', path: '/zakat/distributions' },
        ]}
      />

      <form onSubmit={handleSubmit}>
        <Card>
          {verified.length === 0 ? (
            <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:border-yellow-700 dark:text-yellow-200">
              No verified beneficiaries yet. Verify a beneficiary before recording a distribution.
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigate('/zakat/beneficiaries')}
                className="mt-2"
              >
                Go to Beneficiaries
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select
                label="Beneficiary"
                value={form.beneficiaryId}
                error={errors.beneficiaryId}
                onChange={(e) => {
                  setForm({ ...form, beneficiaryId: e.target.value });
                  if (errors.beneficiaryId) setErrors({ ...errors, beneficiaryId: '' });
                }}
                options={[
                  { value: '', label: 'Select a verified beneficiary' },
                  ...verified.map((b) => ({
                    value: b.id,
                    label: toTitleCase(
                      (b.memberId && typeof b.memberId === 'object' ? b.memberId.name : b.name) || ''
                    ) || 'Unnamed',
                  })),
                ]}
                required
                className="md:col-span-2"
              />

              <Input
                label="Amount"
                type="number"
                value={form.amount}
                error={errors.amount}
                onChange={(e) => {
                  setForm({ ...form, amount: e.target.value });
                  if (errors.amount) setErrors({ ...errors, amount: '' });
                }}
                placeholder="0"
                required
              />

              <Input
                label="Distribution Date"
                type="date"
                value={form.distributionDate}
                error={errors.distributionDate}
                onChange={(e) => setForm({ ...form, distributionDate: e.target.value })}
              />

              <Select
                label="Type"
                value={form.type}
                error={errors.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                options={DISTRIBUTION_TYPE_OPTIONS}
              />

              <Input
                label="Receipt No."
                value={form.receiptNo}
                error={errors.receiptNo}
                onChange={(e) => setForm({ ...form, receiptNo: e.target.value })}
                placeholder="Optional"
              />

              <div className="md:col-span-2">
                <Input
                  label="Remarks"
                  value={form.remarks}
                  error={errors.remarks}
                  onChange={(e) => setForm({ ...form, remarks: e.target.value })}
                  placeholder="Optional notes"
                />
              </div>

              <label className="flex items-center gap-2 md:col-span-2">
                <Checkbox
                  checked={form.postToLedger}
                  onChange={(e) => setForm({ ...form, postToLedger: e.target.checked })}
                />
                <span className="text-sm text-gray-700 dark:text-gray-200">
                  Post an expense entry to the ledger
                </span>
              </label>
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end border-t border-gray-200 dark:border-gray-700 pt-4">
            <Button type="button" variant="outline" onClick={() => navigate('/zakat/distributions')}>
              <FiArrowLeft className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={saving || verified.length === 0}>
              {saving ? 'Saving...' : 'Record Distribution'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
