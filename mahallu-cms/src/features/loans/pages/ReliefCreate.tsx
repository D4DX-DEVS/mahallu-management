import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { toast } from '@/store/toastStore';
import { reliefService, RELIEF_URGENCY_OPTIONS } from '@/services/qardService';
import { familyService } from '@/services/familyService';
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
  familyId: { label: 'family', type: 'id' },
  title: { label: 'title', required: true, maxLength: LIMITS.title.max },
  titleMl: { label: 'title', maxLength: LIMITS.title.max },
  description: { label: 'description', maxLength: LIMITS.description.max },
  urgency: { label: 'urgency', required: true, maxLength: LIMITS.shortText.max },
  followUpDate: { label: 'follow up date', type: 'date' },
};

export default function ReliefCreate() {
  const navigate = useNavigate();
  const [families, setFamilies] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    familyId: '',
    title: '',
    titleMl: '',
    description: '',
    urgency: 'medium',
    followUpDate: '',
  });
  const { errors, validate } = useFormValidation(RULES);

  useEffect(() => {
    // /families caps `limit` at 100 and answers 400 above it, so the old
    // `limit: 200` request always failed and this picker was always empty.
    familyService
      .getAllForExport()
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
    setError(null);

    if (!form.title.trim()) {
      setError('Give the case a short title');
      return;
    }

    try {
      setSaving(true);
      const created = await reliefService.createCase({
        familyId: form.familyId || undefined,
        title: form.title,
        titleMl: form.titleMl || undefined,
        description: form.description || undefined,
        urgency: form.urgency,
        followUpDate: form.followUpDate || undefined,
      });
      toast.success('Case reported');
      navigate(`/relief/${created.id}`);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'report the case' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <PageHeader
        title="Report an Emergency Case"
        description="Recorded as reported; verification and assistance follow"
        breadcrumbs={[{ label: 'Emergency Relief', path: '/relief' }]}
      />

      <form onSubmit={handleSubmit}>
        <Card>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Title"
              value={form.title}
              error={errors.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Roof collapsed after heavy rain"
              required
            />

            <Input
              label="Title (Malayalam)"
              value={form.titleMl}
              error={errors.titleMl}
              onChange={(e) => setForm({ ...form, titleMl: e.target.value })}
              placeholder="Optional"
            />

            <SearchableSelect
              label="Family"
              value={form.familyId}
              error={errors.familyId}
              onChange={(value) => setForm({ ...form, familyId: value })}
              options={families.map((family: any) => ({
                value: family._id || family.id,
                label: `${toTitleCase(family.houseName)}${family.mahallId ? ` - ${family.mahallId}` : ''}`,
              }))}
              placeholder="Search families..."
              helperText="Optional, but helps link the case to a household"
            />

            <Select
              label="Urgency"
              value={form.urgency}
              error={errors.urgency}
              onChange={(e) => setForm({ ...form, urgency: e.target.value })}
              options={RELIEF_URGENCY_OPTIONS}
              required
            />

            <Input
              label="Follow-up date"
              type="date"
              value={form.followUpDate}
              error={errors.followUpDate}
              onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
            />

            <div className="md:col-span-2">
              <Input
                label="Description"
                value={form.description}
                error={errors.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What happened, and what is needed"
              />
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => navigate('/relief')}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Report Case'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
