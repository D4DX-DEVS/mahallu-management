import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Breadcrumb from '@/components/layout/Breadcrumb';
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
import { FiArrowLeft } from 'react-icons/fi';

export default function DistributionCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [verified, setVerified] = useState<ZakatBeneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
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

  useEffect(() => {
    // Only verified beneficiaries can be paid
    zakatDistributionService
      .getBeneficiaries({ verificationStatus: 'verified', status: 'active', limit: 200 })
      .then((result) => setVerified(result.data))
      .catch(() => setVerified([]))
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
    const newErrors: Record<string, string> = {};

    if (!form.beneficiaryId) {
      newErrors.beneficiaryId = 'Select a beneficiary';
    }
    if (!form.amount) {
      newErrors.amount = 'Enter the amount';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      return;
    }

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
      toast.error(err.response?.data?.message || 'Failed to record distribution');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Record Zakat Distribution
          </h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Register a payment to a verified beneficiary
          </p>
        </div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Zakat', path: '/zakat' },
            { label: 'Distributions', path: '/zakat/distributions' },
            { label: 'New' },
          ]}
        />
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-3 sm:p-4">
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
                onChange={(e) => {
                  setForm({ ...form, beneficiaryId: e.target.value });
                  if (errors.beneficiaryId) setErrors({ ...errors, beneficiaryId: '' });
                }}
                options={[
                  { value: '', label: 'Select a verified beneficiary' },
                  ...verified.map((b) => ({
                    value: b.id,
                    label:
                      (b.memberId && typeof b.memberId === 'object' ? b.memberId.name : b.name) ||
                      'Unnamed',
                  })),
                ]}
                error={errors.beneficiaryId}
                required
                className="md:col-span-2"
              />

              <Input
                label="Amount"
                type="number"
                value={form.amount}
                onChange={(e) => {
                  setForm({ ...form, amount: e.target.value });
                  if (errors.amount) setErrors({ ...errors, amount: '' });
                }}
                placeholder="0"
                error={errors.amount}
                required
              />

              <Input
                label="Distribution Date"
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
                label="Receipt No."
                value={form.receiptNo}
                onChange={(e) => setForm({ ...form, receiptNo: e.target.value })}
                placeholder="Optional"
              />

              <div className="md:col-span-2">
                <Input
                  label="Remarks"
                  value={form.remarks}
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
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/zakat/distributions')}
            >
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
