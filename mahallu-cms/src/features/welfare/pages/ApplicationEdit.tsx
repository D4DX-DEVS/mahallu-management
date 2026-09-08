import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { welfareService, WelfareScheme } from '@/services/welfareService';
import { familyService } from '@/services/familyService';
import { toast } from '@/store/toastStore';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { useFormValidation } from '@/hooks/useFormValidation';
import { FieldRule, LIMITS } from '@/utils/validation';

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
const idOf = (value: any) => (typeof value === 'object' && value ? value._id || value.id : value || '');
export default function ApplicationEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [schemes, setSchemes] = useState<WelfareScheme[]>([]);
  const [families, setFamilies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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
    if (!id) return;
    Promise.all([
      welfareService.getSchemes({ page: 1, limit: 100, status: 'active' }),
      familyService.getAll({ page: 1, limit: 200 }),
      welfareService.getApplication(id),
    ])
      .then(([schemeResult, familyResult, application]) => {
        setSchemes(schemeResult.data);
        setFamilies(familyResult.data);
        setForm({
          schemeId: idOf(application.schemeId),
          familyId: idOf(application.familyId),
          requestedAmount: String(application.requestedAmount ?? ''),
          priority: application.priority,
          reason: application.reason || '',
        });
      })
      .catch(() => toast.error("Couldn't load application. Please try again."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Every field checked at once, each message on its own field.
    if (!validate(form)) return;
    if (!id) return;
    try {
      setSaving(true);
      await welfareService.updateApplication(id, {
        schemeId: form.schemeId,
        familyId: form.familyId,
        requestedAmount: Number(form.requestedAmount),
        priority: form.priority,
        reason: form.reason,
      });
      toast.success('Application updated');
      navigate(`/welfare/applications/${id}`);
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'update application' }));
    } finally {
      setSaving(false);
    }
  };
  if (loading) {
    return <PageSkeleton variant="section" />;
  }
  return (
    <div className="space-y-3">
      <PageHeader
        description="Status moves through the application detail page, not here"
        title="Edit"
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
                  if (errors.schemeId) setFieldErrors({ ...fieldErrors, schemeId: '' });
                }}
                options={[
                  { value: '', label: 'Select a scheme' },
                  ...schemes.map((scheme) => ({ value: scheme.id, label: scheme.name })),
                ]}
                required
              />
              {errors.schemeId && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.schemeId}</p>
              )}
            </div>
            <div>
              <SearchableSelect
                label="Family"
                value={form.familyId}
                error={errors.familyId}
                onChange={(value) => {
                  setForm({ ...form, familyId: value });
                  if (errors.familyId) setFieldErrors({ ...fieldErrors, familyId: '' });
                }}
                options={families.map((family: any) => ({
                  value: family._id || family.id,
                  label: `${family.houseName}${family.familyHead ? ` - ${family.familyHead}` : ''}`,
                }))}
                placeholder="Search family..."
                required
              />
              {errors.familyId && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.familyId}</p>
              )}
            </div>
            <div>
              <Input
                label="Requested Amount"
                type="number"
                value={form.requestedAmount}
                error={errors.requestedAmount}
                onChange={(e) => {
                  setForm({ ...form, requestedAmount: e.target.value });
                  if (errors.requestedAmount) setFieldErrors({ ...fieldErrors, requestedAmount: '' });
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
            <Button type="button" variant="outline" onClick={() => navigate(`/welfare/applications/${id}`)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
