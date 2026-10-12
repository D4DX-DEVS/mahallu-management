import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import PageHeader from '@/components/ui/PageHeader';
import { welfareService, WelfareScheme } from '@/services/welfareService';
import { familyService } from '@/services/familyService';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import AmountInput from '@/components/ui/AmountInput';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import UnsavedChangesDialog from '@/components/ui/UnsavedChangesDialog';

export default function ApplicationCreate() {
  const navigate = useNavigate();
  const [schemes, setSchemes] = useState<WelfareScheme[]>([]);
  const [families, setFamilies] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    schemeId: '',
    familyId: '',
    requestedAmount: '',
    priority: 'medium',
    reason: '',
  });
  const initialForm = useRef(JSON.stringify(form));
  const guard = useUnsavedChangesGuard(!saving && JSON.stringify(form) !== initialForm.current);

  useEffect(() => {
    welfareService
      .getSchemes({ page: 1, limit: 100, status: 'active' })
      .then((result) => setSchemes(result.data))
      .catch(() => setSchemes([]));
    familyService
      .getAll({ page: 1, limit: 200 })
      .then((result) => setFamilies(result.data))
      .catch(() => setFamilies([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!form.schemeId) {
      newErrors.schemeId = 'Scheme is required';
    }
    if (!form.requestedAmount) {
      newErrors.requestedAmount = 'Requested amount is required';
    }
    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }
    try {
      setSaving(true);
      const application = await welfareService.createApplication({
        schemeId: form.schemeId,
        familyId: form.familyId || undefined,
        requestedAmount: Number(form.requestedAmount),
        priority: form.priority,
        reason: form.reason,
      });
      toast.success('Application created');
      navigate(`/welfare/applications/${application.id}`);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create application. Check the details and try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="New Welfare Application"
        description="Applications always start as pending and move through verification"
      />

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <Card>
            <div className="mb-3.5">
              <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Application details</h2>
              <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Scheme, applicant and supporting details</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Select
                  label="Scheme"
                  value={form.schemeId}
                  onChange={(e) => {
                    setForm({ ...form, schemeId: e.target.value });
                    if (fieldErrors.schemeId) {
                      setFieldErrors({ ...fieldErrors, schemeId: '' });
                    }
                  }}
                  options={[
                    { value: '', label: 'Select a scheme' },
                    ...schemes.map((scheme) => ({ value: scheme.id, label: scheme.name })),
                  ]}
                  required
                />
                {fieldErrors.schemeId && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.schemeId}</p>}
              </div>

              <SearchableSelect
                label="Family"
                value={form.familyId}
                onChange={(value) => setForm({ ...form, familyId: value })}
                options={families.map((family: any) => ({
                  value: family.id,
                  label: `${family.houseName}${family.familyHead ? ` - ${family.familyHead}` : ''}`,
                }))}
                placeholder="Search family..."
              />

              <div>
                <AmountInput
                  label="Requested Amount"
                  value={form.requestedAmount}
                  onChange={(e) => {
                    setForm({ ...form, requestedAmount: e.target.value });
                    if (fieldErrors.requestedAmount) {
                      setFieldErrors({ ...fieldErrors, requestedAmount: '' });
                    }
                  }}
                  required
                />
                {fieldErrors.requestedAmount && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.requestedAmount}</p>}
              </div>

              <Select
                label="Priority"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                options={[
                  { value: 'low', label: 'Low' },
                  { value: 'medium', label: 'Medium' },
                  { value: 'high', label: 'High' },
                  { value: 'urgent', label: 'Urgent' },
                ]}
              />

              <div className="md:col-span-2">
                <Input
                  label="Reason"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Why is this assistance needed?"
                />
              </div>
            </div>
          </Card>

          <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none border-t border-line bg-white/90 px-4 py-3 backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button type="button" variant="secondary" onClick={() => guard.guardedNavigate('/welfare/applications')}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Create Application'}
            </Button>
          </div>
        </div>
      </form>
      <UnsavedChangesDialog guard={guard} />
    </div>
  );
}
