import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import DateInput from '@/components/ui/DateInput';
import RadioCardGroup from '@/components/ui/RadioCardGroup';
import { PageSkeleton } from '@/components/ui/Skeleton';
import PageHeader from '@/components/layout/PageHeader';
import {
  surveyFormService,
  SurveyType,
  SURVEY_TYPE_OPTIONS,
  RESPONDENT_OPTIONS,
  SurveyForm,
  SurveyScope,
} from '@/services/surveyFormService';
import type { RespondentType } from '../formEngine';
import { toast } from '@/store/toastStore';
import { useAuthStore } from '@/store/authStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';

interface FormState {
  title: string;
  type: SurveyType;
  description: string;
  startDate: string;
  endDate: string;
  targetCount: string;
  respondentType: RespondentType;
  scope: SurveyScope;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const EMPTY: FormState = {
  title: '',
  type: 'household',
  description: '',
  startDate: today(),
  endDate: '',
  targetCount: '',
  respondentType: 'family',
  scope: 'mahallu',
};

const SCOPE_OPTIONS: { value: SurveyScope; label: string }[] = [
  { value: 'global', label: 'All Mahallus — one form for every Mahallu' },
  { value: 'mahallu', label: 'The selected Mahallu only' },
];

const validate = (form: FormState, hasMahallu: boolean): Record<string, string> => {
  const errors: Record<string, string> = {};
  if (form.scope === 'mahallu' && !hasMahallu) errors.scope = 'Select a Mahallu first, or make this survey available to all Mahallus.';
  if (form.title.trim().length < 3) errors.title = 'Please enter a survey name of at least 3 characters.';
  if (!form.startDate) errors.startDate = 'Please choose the start date.';
  if (form.endDate && form.startDate && form.endDate < form.startDate) errors.endDate = 'The end date cannot be before the start date.';
  if (form.targetCount && !/^\d+$/.test(form.targetCount.trim())) errors.targetCount = 'Please enter a whole number.';
  else if (form.targetCount && Number(form.targetCount) < 1) errors.targetCount = 'Please enter 1 or more.';
  if (form.description.length > 2000) errors.description = 'Please keep the description under 2000 characters.';
  return errors;
};

/** Create a survey (then go straight to its form builder), or edit an existing survey's details. */
export default function SurveyFormModal() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const currentTenantId = useAuthStore((state) => state.currentTenantId);
  // A Super Admin creates surveys for all Mahallus by default; a Mahallu admin always for their own.
  const [form, setForm] = useState<FormState>(() => ({ ...EMPTY, scope: isSuperAdmin ? 'global' : 'mahallu' }));
  const [existing, setExisting] = useState<SurveyForm | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    surveyFormService
      .get(id)
      .then((survey) => {
        setExisting(survey);
        setForm({
          title: survey.title,
          type: survey.type,
          description: survey.description || '',
          startDate: survey.startDate?.slice(0, 10) || '',
          endDate: survey.endDate?.slice(0, 10) || '',
          targetCount: survey.targetCount ? String(survey.targetCount) : '',
          respondentType: survey.respondentType,
          scope: survey.scope || 'mahallu',
        });
      })
      .catch((err) => toast.error(loadErrorMessage(err, 'survey')))
      .finally(() => setLoading(false));
  }, [id]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found = validate(form, Boolean(currentTenantId));
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    const payload = {
      title: form.title.trim(),
      type: form.type,
      description: form.description.trim(),
      startDate: form.startDate,
      endDate: form.endDate || null,
      targetCount: form.targetCount ? Number(form.targetCount) : null,
      respondentType: form.respondentType,
      ...(isEdit ? {} : { scope: form.scope }),
    };
    try {
      setSaving(true);
      if (id) {
        await surveyFormService.update(id, payload);
        toast.success('Survey details saved');
        navigate(`/survey/${id}`, { replace: true });
      } else {
        const survey = await surveyFormService.create(payload);
        toast.success('Survey created. Now add its questions.');
        navigate(`/survey/${survey.id}/builder`, { replace: true });
      }
    } catch (err) {
      toast.error(errorMessage(err, { action: id ? 'save the survey' : 'create the survey' }));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton variant="section" />;

  const respondentLocked = isEdit && !!existing && (existing.counts?.responses || 0) + (existing.counts?.draft || 0) > 0;

  return (
    <div className="space-y-3">
      <PageHeader
        title={isEdit ? 'Edit survey details' : 'New survey'}
        description={isEdit ? 'Name, period and target. Questions are edited in the form builder.' : 'Set up the survey, then design its form.'}
      />
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {isSuperAdmin && !isEdit && (
            <div className="md:col-span-2">
              <RadioCardGroup
                label="Available to"
                columns={2}
                value={form.scope}
                error={errors.scope}
                onChange={(value) => set('scope', value === 'mahallu' ? 'mahallu' : 'global')}
                options={SCOPE_OPTIONS}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                {form.scope === 'global'
                  ? "Every Mahallu's survey workers fill this same form. Each Mahallu sees and reviews only its own responses, and only you can change the form."
                  : currentTenantId
                    ? 'Only the Mahallu selected in the top bar gets this survey.'
                    : 'Select a Mahallu in the top bar first.'}
              </p>
            </div>
          )}
          <div className="md:col-span-2">
            <Input
              label="Survey name"
              required
              value={form.title}
              error={errors.title}
              maxLength={200}
              placeholder="e.g. Household census 2026"
              onChange={(e) => set('title', e.target.value)}
            />
          </div>
          <Select
            label="Survey type"
            required
            value={form.type}
            onChange={(e) => set('type', e.target.value as SurveyType)}
            options={SURVEY_TYPE_OPTIONS}
          />
          <Input
            label="Target responses"
            inputMode="numeric"
            value={form.targetCount}
            error={errors.targetCount}
            helperText="Optional. Shows progress on the survey."
            placeholder="e.g. 250"
            onChange={(e) => set('targetCount', e.target.value)}
          />
          <DateInput label="Start date" required value={form.startDate} error={errors.startDate} onValueChange={(v) => set('startDate', v)} />
          <DateInput
            label="End date"
            value={form.endDate}
            error={errors.endDate}
            min={form.startDate || undefined}
            helperText="Optional. Leave empty for an open-ended survey."
            onValueChange={(v) => set('endDate', v)}
          />
          <div className="md:col-span-2">
            <Textarea
              label="Description"
              rows={3}
              value={form.description}
              error={errors.description}
              placeholder="What this survey is for and who should be surveyed"
              onChange={(e) => set('description', e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <RadioCardGroup
              label="Each response is about"
              columns={3}
              value={form.respondentType}
              onChange={(value) => !respondentLocked && set('respondentType', value as RespondentType)}
              options={RESPONDENT_OPTIONS.map((o) => ({ value: o.value, label: `${o.label} — ${o.description}` }))}
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              {respondentLocked
                ? 'This survey already has responses, so this can no longer change.'
                : 'Linking to a family or member lets questions fill in automatically from that record.'}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={() => navigate(isEdit ? `/survey/${id}` : '/survey')}>
            Cancel
          </Button>
          <Button type="submit" isLoading={saving} loadingText="Saving">
            {isEdit ? 'Save details' : 'Create and design form'}
          </Button>
        </div>
      </form>
    </div>
  );
}
