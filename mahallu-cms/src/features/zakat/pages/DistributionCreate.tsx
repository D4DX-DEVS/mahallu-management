import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import {
  zakatDistributionService,
  ZakatBeneficiary,
  ZakatFund,
} from '@/services/zakatDistributionService';
import { FiArrowLeft } from 'react-icons/fi';
import ZakatFundMeter from '../components/ZakatFundMeter';
import DistributionFields, {
  DistributionForm,
  emptyDistributionForm,
  beneficiaryId,
} from '../components/DistributionFields';

export default function DistributionCreate() {
  const navigate = useNavigate();
  const location = useLocation();
  const [verified, setVerified] = useState<ZakatBeneficiary[]>([]);
  const [fund, setFund] = useState<ZakatFund | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<DistributionForm>(emptyDistributionForm());

  useEffect(() => {
    // Only verified beneficiaries can be paid
    Promise.all([
      zakatDistributionService
        .getBeneficiaries({ verificationStatus: 'verified', status: 'active', limit: 200 })
        .then((result) => setVerified(result.data))
        .catch(() => setVerified([])),
      zakatDistributionService.getFund().then(setFund).catch(() => setFund(null)),
    ]).finally(() => setLoading(false));
  }, []);

  // Preselect beneficiary from state if provided
  useEffect(() => {
    const state = location.state as { beneficiaryId?: string } | null;
    if (state?.beneficiaryId && verified.length) {
      const b = verified.find((x) => beneficiaryId(x) === state.beneficiaryId);
      setForm((prev) => ({
        ...prev,
        beneficiaryId: state.beneficiaryId as string,
        asnafCategory: b && b.category !== 'other' ? b.category : prev.asnafCategory,
      }));
    }
  }, [location.state, verified]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!form.beneficiaryId) newErrors.beneficiaryId = 'Select a beneficiary';
    if (!form.asnafCategory) newErrors.asnafCategory = 'Choose the asnaf category';
    if (!form.amount || Number(form.amount) <= 0) newErrors.amount = 'Enter an amount greater than zero';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    try {
      setSaving(true);
      const payload: Record<string, any> = { ...form, amount: Number(form.amount) };
      if (!payload.receiptNo) delete payload.receiptNo;
      const result = await zakatDistributionService.createDistribution(payload);
      toast.success(
        result.status === 'proposed'
          ? 'Distribution proposed. It needs approval before it is paid out.'
          : 'Distribution recorded'
      );
      navigate('/zakat/distributions');
    } catch (err: any) {
      toast.error(getFriendlyError(err, "We couldn't record this distribution. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Record Zakat Distribution"
        description="Register a payment to a verified beneficiary"
      />

      <ZakatFundMeter fund={fund} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <div className="mb-3.5">
            <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Distribution details</h2>
            <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">
              The amount cannot be more than the zakat fund available.
            </p>
          </div>
          {verified.length === 0 ? (
            <Alert tone="warning">
              No verified beneficiaries yet. Verify a beneficiary before recording a distribution.
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => navigate('/zakat/beneficiaries')}
                className="mt-2"
              >
                Go to Beneficiaries
              </Button>
            </Alert>
          ) : (
            <DistributionFields form={form} setForm={setForm} verified={verified} fund={fund} errors={errors} />
          )}
        </Card>

        <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none border-t border-line bg-white/90 px-4 py-3 backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
          <Button type="button" variant="secondary" onClick={() => navigate('/zakat/distributions')}>
            <FiArrowLeft className="h-3.5 w-3.5" />
            Cancel
          </Button>
          <Button type="submit" disabled={saving || verified.length === 0}>
            {saving ? 'Saving...' : 'Record Distribution'}
          </Button>
        </div>
      </form>
    </div>
  );
}
