import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { welfareService, WelfareScheme } from '@/services/welfareService';
import { familyService } from '@/services/familyService';
import { fetchAllPages } from '@/services/api';
import { toast } from '@/store/toastStore';
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
  schemeId: { label: 'scheme', required: true, type: 'id' },
  familyId: { label: 'family', type: 'id' },
  requestedAmount: { label: 'requested amount', required: true, type: 'number', min: 1, max: LIMITS.amount.max },
  priority: { label: 'priority', maxLength: LIMITS.shortText.max },
  reason: { label: 'reason', maxLength: LIMITS.notes.max },
};

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
  const { errors, validate } = useFormValidation(RULES);

  useEffect(() => {
    welfareService
      .getSchemes({ page: 1, limit: 100, status: 'active' })
      .then((result) => setSchemes(result.data))
      .catch(() => setSchemes([]));
    // /families caps limit at 100 and 400s above it, so the old limit:200
    // request always failed and left this picker empty.
    fetchAllPages((p) => familyService.getAll(p))
      .then((rows) => setFamilies(rows))
      .catch((err) => {
        setFamilies([]);
        toast.error(loadErrorMessage(err, 'families'));
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Every field checked at once, each message on its own field.
    if (!validate(form)) return;
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
      toast.error(errorMessage(err, { action: 'create application' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <PageHeader
        title="New Welfare Application"
        description="Applications always start as pending and move through verification"
        breadcrumbs={[{ label: 'Welfare', path: '/welfare/applications' }]}
      />

      <form onSubmit={handleSubmit}>
        <Card>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Select
                label="Scheme"
                value={form.schemeId}
                error={errors.schemeId}
                onChange={(e) => {
                  setForm({ ...form, schemeId: e.target.value });
                  if (errors.schemeId) {
                    setFieldErrors({ ...fieldErrors, schemeId: '' });
                  }
                }}
                options={[
                  { value: '', label: 'Select a scheme' },
                  ...schemes.map((scheme) => ({ value: scheme.id, label: toTitleCase(scheme.name) })),
                ]}
                required
              />
              {errors.schemeId && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.schemeId}</p>
              )}
            </div>

            <SearchableSelect
              label="Family"
              value={form.familyId}
              error={errors.familyId}
              onChange={(value) => setForm({ ...form, familyId: value })}
              options={families.map((family: any) => ({
                value: family._id || family.id,
                label: `${toTitleCase(family.houseName)}${family.familyHead ? ` - ${toTitleCase(family.familyHead)}` : ''}`,
              }))}
              placeholder="Search family..."
            />

            <div>
              <Input
                label="Requested Amount"
                type="number"
                value={form.requestedAmount}
                error={errors.requestedAmount}
                onChange={(e) => {
                  setForm({ ...form, requestedAmount: e.target.value });
                  if (errors.requestedAmount) {
                    setFieldErrors({ ...fieldErrors, requestedAmount: '' });
                  }
                }}
                required
              />
              {errors.requestedAmount && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.requestedAmount}</p>
              )}
            </div>

            <Select
              label="Priority"
              value={form.priority}
              error={errors.priority}
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
                error={errors.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Why is this assistance needed?"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => navigate('/welfare/applications')}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Create Application'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
