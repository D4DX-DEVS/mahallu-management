import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { memberPortalService } from '@/services/memberPortalService';
import { ROUTES } from '@/constants/routes';
import { FiCheckCircle } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

type NOCType = 'nikah' | 'common' | null;

interface NikahFormData {
  brideName: string;
  brideAge: string;
  nikahDate: string;
  venue: string;
  remarks: string;
}

interface CommonFormData {
  purposeTitle: string;
  purposeDescription: string;
}

export default function MemberNOCRequest() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);

  const [selectedType, setSelectedType] = useState<NOCType>(null);
  const [nikahForm, setNikahForm] = useState<NikahFormData>({
    brideName: '', brideAge: '', nikahDate: '', venue: '', remarks: '',
  });
  const [commonForm, setCommonForm] = useState<CommonFormData>({
    purposeTitle: '', purposeDescription: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const validateNikah = () => {
    const errs: Record<string, string> = {};
    if (!nikahForm.brideName.trim()) errs.brideName = 'Bride name is required';
    if (!nikahForm.nikahDate) errs.nikahDate = 'Nikah date is required';
    if (!nikahForm.venue.trim()) errs.venue = 'Venue is required';
    return errs;
  };

  const validateCommon = () => {
    const errs: Record<string, string> = {};
    if (!commonForm.purposeTitle.trim()) errs.purposeTitle = 'Purpose title is required';
    if (!commonForm.purposeDescription.trim()) errs.purposeDescription = 'Purpose description is required';
    return errs;
  };

  const handleSubmit = async () => {
    if (!selectedType) return;
    const errs = selectedType === 'nikah' ? validateNikah() : validateCommon();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setErrors({});

    const payload =
      selectedType === 'nikah'
        ? {
            type: 'nikah' as const,
            brideName: nikahForm.brideName,
            brideAge: nikahForm.brideAge ? Number(nikahForm.brideAge) : undefined,
            nikahDate: nikahForm.nikahDate,
            venue: nikahForm.venue,
            remarks: nikahForm.remarks || undefined,
          }
        : {
            type: 'common' as const,
            purposeTitle: commonForm.purposeTitle,
            purposeDescription: commonForm.purposeDescription,
          };

    try {
      setSubmitting(true);
      setErrorMsg(null);
      await memberPortalService.requestNOC(payload);
      setSuccessMsg('NOC request submitted. An admin will review it next.');
      setTimeout(() => navigate(ROUTES.MEMBER.NOC_LIST), 2000);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't submit NOC request. Try again in a moment."));
    } finally {
      setSubmitting(false);
    }
  };

  if (successMsg) {
    return (
      <div className="mx-auto mt-10 max-w-xl">
        <Card padding="lg">
          <div className="space-y-3 py-4 text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-primary-600 dark:bg-brand-lime/10 dark:text-brand-lime">
              <FiCheckCircle className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="text-base font-bold text-primary-700 dark:text-brand-lime">{successMsg}</p>
            <p className="text-xs text-[#7B8983] dark:text-surface-muted">Redirecting to your NOC list…</p>
          </div>
        </Card>
      </div>
    );
  }

  const typeCard =
    'block w-full rounded-card border border-line bg-white p-5 text-left shadow-card transition-[border-color,box-shadow] hover:border-primary-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] dark:border-surface-border dark:bg-surface-card dark:hover:border-brand-lime';

  const formActions = (
    <div className="mt-5 flex gap-2 border-t border-line-soft pt-4 dark:border-surface-border">
      <Button onClick={handleSubmit} isLoading={submitting} className="flex-1">
        {submitting ? 'Submitting…' : 'Submit Request'}
      </Button>
      <Button variant="secondary" onClick={() => navigate(ROUTES.MEMBER.NOC_LIST)}>
        Cancel
      </Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader
        title="Request NOC"
        description="Apply for a no-objection certificate"
        actions={
          <Button variant="secondary" onClick={() => navigate(ROUTES.MEMBER.NOC_LIST)}>
            ← Back
          </Button>
        }
      />

      {/* Step 1: Select Type */}
      {!selectedType && (
        <div className="space-y-3">
          <p className="text-[13px] text-[#5B6963] dark:text-surface-muted">Select the type of NOC you want to apply for:</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button onClick={() => setSelectedType('nikah')} className={typeCard}>
              <div className="mb-2 text-2xl">💍</div>
              <h3 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Nikah (Marriage) NOC</h3>
              <p className="mt-1 text-xs text-[#7B8983] dark:text-surface-muted">For marriage (nikah) ceremony</p>
            </button>
            <button onClick={() => setSelectedType('common')} className={typeCard}>
              <div className="mb-2 text-2xl">📄</div>
              <h3 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Common NOC</h3>
              <p className="mt-1 text-xs text-[#7B8983] dark:text-surface-muted">For general or other purposes</p>
            </button>
          </div>
        </div>
      )}

      {/* Step 2a: Nikah Form */}
      {selectedType === 'nikah' && (
        <Card padding="lg">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">💍 Nikah NOC Details</h2>
              <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Tell us about the nikah</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelectedType(null)}>
              Change type
            </Button>
          </div>
          <div className="space-y-4">
            <Input label="Groom Name (Your Name)" type="text" value={user?.name || ''} readOnly />
            <Input
              label="Bride Name"
              type="text"
              required
              value={nikahForm.brideName}
              onChange={(e) => setNikahForm({ ...nikahForm, brideName: e.target.value })}
              placeholder="Enter bride's full name"
              error={errors.brideName}
            />
            <Input
              label="Bride Age"
              type="number"
              value={nikahForm.brideAge}
              onChange={(e) => setNikahForm({ ...nikahForm, brideAge: e.target.value })}
              placeholder="Age in years"
              min={1}
              max={120}
            />
            <Input
              label="Nikah Date"
              type="date"
              required
              value={nikahForm.nikahDate}
              onChange={(e) => setNikahForm({ ...nikahForm, nikahDate: e.target.value })}
              error={errors.nikahDate}
            />
            <Input
              label="Venue / Location"
              type="text"
              required
              value={nikahForm.venue}
              onChange={(e) => setNikahForm({ ...nikahForm, venue: e.target.value })}
              placeholder="Where will the nikah take place?"
              error={errors.venue}
            />
            <div>
              <label className={labelClasses}>Additional Remarks</label>
              <textarea
                value={nikahForm.remarks}
                onChange={(e) => setNikahForm({ ...nikahForm, remarks: e.target.value })}
                placeholder="Any additional information…"
                rows={3}
                className={`${controlClasses} resize-none py-2`}
              />
            </div>
          </div>
          {errorMsg && <Alert tone="danger" className="mt-4">{errorMsg}</Alert>}
          {formActions}
        </Card>
      )}

      {/* Step 2b: Common Form */}
      {selectedType === 'common' && (
        <Card padding="lg">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">📄 Common NOC Details</h2>
              <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Describe the purpose of this NOC</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => setSelectedType(null)}>
              Change type
            </Button>
          </div>
          <div className="space-y-4">
            <Input label="Applicant Name" type="text" value={user?.name || ''} readOnly />
            <Input
              label="Purpose Title"
              type="text"
              required
              value={commonForm.purposeTitle}
              onChange={(e) => setCommonForm({ ...commonForm, purposeTitle: e.target.value })}
              placeholder="Brief title for this NOC"
              error={errors.purposeTitle}
            />
            <div>
              <label className={labelClasses}>
                Description / Reason <span className="text-[#D9534F]">*</span>
              </label>
              <textarea
                value={commonForm.purposeDescription}
                onChange={(e) => setCommonForm({ ...commonForm, purposeDescription: e.target.value })}
                placeholder="Describe the purpose and reason for this NOC request…"
                rows={5}
                className={`${controlClasses} resize-none py-2`}
              />
              {errors.purposeDescription && (
                <p role="alert" className="mt-1.5 text-[12px] font-medium text-[#B3261E] dark:text-red-300">{errors.purposeDescription}</p>
              )}
            </div>
          </div>
          {errorMsg && <Alert tone="danger" className="mt-4">{errorMsg}</Alert>}
          {formActions}
        </Card>
      )}
    </div>
  );
}
