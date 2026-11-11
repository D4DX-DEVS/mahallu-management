import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiCheckCircle, FiSave, FiTrash2 } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Stepper from '@/components/ui/Stepper';
import SearchableSelect, { SearchableSelectOption } from '@/components/ui/SearchableSelect';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import { PageSkeleton } from '@/components/ui/Skeleton';
import PageHeader from '@/components/layout/PageHeader';
import { surveyFormService, SurveyForm, FILL_STATE_LABELS } from '@/services/surveyFormService';
import { familyService } from '@/services/familyService';
import { memberService } from '@/services/memberService';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import type { Family, Member } from '@/types';
import {
  Answers,
  SurveyFormContent,
  buildAutoFillUpdates,
  fieldIdFromKey,
  validateAnswers,
  visibleFieldIds,
} from '../formEngine';
import SurveyPageFields from '../components/SurveyPageFields';

const AUTOSAVE_MS = 30_000;

interface Respondent {
  familyId: string;
  memberId: string;
  option: SearchableSelectOption | null;
}

const EMPTY_RESPONDENT: Respondent = { familyId: '', memberId: '', option: null };

const refId = (value: unknown): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  const ref = value as { id?: string; _id?: string };
  return String(ref.id || ref._id || '');
};

/**
 * Fill a survey: instructions, the respondent (when the survey is about a family or member), then
 * the form page by page. Each page is checked before moving on; drafts are saved on request and
 * every 30 seconds while something changed. The server checks everything again on submit.
 */
export default function SurveyFill() {
  const { id = '', subId } = useParams<{ id: string; subId?: string }>();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState<SurveyForm | null>(null);
  const [content, setContent] = useState<SurveyFormContent | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftId, setDraftId] = useState<string | undefined>(subId);
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [respondent, setRespondent] = useState<Respondent>(EMPTY_RESPONDENT);
  const [respondentError, setRespondentError] = useState('');
  const [respondentOptions, setRespondentOptions] = useState<SearchableSelectOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [started, setStarted] = useState(Boolean(subId));
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const lastSaved = useRef<string>('');

  const snapshot = useCallback(
    () => JSON.stringify({ answers, familyId: respondent.familyId, memberId: respondent.memberId }),
    [answers, respondent.familyId, respondent.memberId]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const form = await surveyFormService.getForm(id);
        if (cancelled) return;
        setSurvey(form.survey);
        setContent(form.version.content);
        if (subId) {
          const { submission } = await surveyFormService.getSubmission(subId);
          if (cancelled) return;
          if (submission.status !== 'draft') {
            navigate(`/survey/${id}/responses/${subId}`, { replace: true });
            return;
          }
          const restored = submission.answers || {};
          const fam = submission.familyId && typeof submission.familyId === 'object' ? submission.familyId : null;
          const mem = submission.memberId && typeof submission.memberId === 'object' ? submission.memberId : null;
          const next: Respondent = {
            familyId: refId(submission.familyId),
            memberId: refId(submission.memberId),
            option: mem
              ? { value: refId(mem), label: String(mem.name || 'Member'), sublabel: mem.familyName ? String(mem.familyName) : undefined }
              : fam
                ? { value: refId(fam), label: [fam.houseName, fam.familyHead].filter(Boolean).join(' - ') }
                : null,
          };
          setAnswers(restored);
          setRespondent(next);
          setPageIndex(Math.min(submission.currentPage || 0, Math.max(0, form.version.content.pages.length - 1)));
          lastSaved.current = JSON.stringify({ answers: restored, familyId: next.familyId, memberId: next.memberId });
          setSavedAt(new Date(submission.updatedAt));
        }
      } catch (err) {
        if (!cancelled) setLoadError(loadErrorMessage(err, 'survey form'));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, subId, navigate]);

  const visible = useMemo(() => (content ? visibleFieldIds(content, answers) : new Set<number>()), [content, answers]);
  const respondentType = survey?.respondentType || 'none';

  /* ---------------------------------------------------------------- respondent ---- */

  const searchRespondents = useCallback(
    async (query: string) => {
      if (respondentType === 'none') return;
      try {
        setSearching(true);
        if (respondentType === 'family') {
          const result = await familyService.getAll({ search: query || undefined, limit: 20 });
          setRespondentOptions(
            result.data.map((f: Family) => ({
              value: f.id,
              label: [f.houseName, f.familyHead].filter(Boolean).join(' - ') || 'Family',
              sublabel: [f.houseNo, f.area || f.place].filter(Boolean).join(', ') || undefined,
            }))
          );
        } else {
          const result = await memberService.getAll({ search: query || undefined, limit: 20, status: 'active' });
          setRespondentOptions(
            result.data.map((m: Member) => ({
              value: m.id,
              label: m.name || 'Member',
              sublabel: m.familyName || undefined,
            }))
          );
        }
      } catch {
        setRespondentOptions([]);
      } finally {
        setSearching(false);
      }
    },
    [respondentType]
  );

  useEffect(() => {
    if (started && respondentType !== 'none') void searchRespondents('');
  }, [started, respondentType, searchRespondents]);

  const pickRespondent = async (value: string) => {
    setRespondentError('');
    if (!value) {
      setRespondent(EMPTY_RESPONDENT);
      return;
    }
    const option = respondentOptions.find((o) => o.value === value) || null;
    try {
      let family: Record<string, unknown> | null = null;
      let member: Record<string, unknown> | null = null;
      if (respondentType === 'member') {
        member = (await memberService.getById(value)) as unknown as Record<string, unknown>;
        const famId = refId(member?.familyId);
        if (famId) family = (await familyService.getById(famId)) as unknown as Record<string, unknown>;
        setRespondent({ familyId: famId, memberId: value, option });
      } else {
        family = (await familyService.getById(value)) as unknown as Record<string, unknown>;
        setRespondent({ familyId: value, memberId: '', option });
      }
      if (content) {
        const updates = buildAutoFillUpdates(content, { family, member }, answers);
        const count = Object.keys(updates).length;
        if (count) {
          setAnswers((prev) => ({ ...prev, ...updates }));
          toast.success(`Filled ${count} answer${count === 1 ? '' : 's'} from the record. Please check them.`);
        }
      }
    } catch (err) {
      setRespondent({ familyId: respondentType === 'family' ? value : '', memberId: respondentType === 'member' ? value : '', option });
      toast.error(errorMessage(err, { action: 'load that record' }));
    }
  };

  /* ---------------------------------------------------------------- saving ---- */

  const payload = (submit: boolean) => ({
    answers,
    submit,
    currentPage: pageIndex,
    ...(respondent.familyId && respondentType === 'family' ? { familyId: respondent.familyId } : {}),
    ...(respondent.memberId && respondentType === 'member' ? { memberId: respondent.memberId } : {}),
  });

  const saveDraft = async (quiet = false): Promise<boolean> => {
    if (saving || submitting) return false;
    try {
      setSaving(true);
      const saved = draftId
        ? await surveyFormService.updateSubmission(draftId, payload(false))
        : await surveyFormService.createSubmission(id, payload(false));
      if (!draftId) {
        setDraftId(saved.id);
        window.history.replaceState(window.history.state, '', `/survey/${id}/fill/${saved.id}`);
      }
      lastSaved.current = snapshot();
      setSavedAt(new Date());
      if (!quiet) toast.success('Draft saved');
      return true;
    } catch (err) {
      if (!quiet) toast.error(errorMessage(err, { action: 'save the draft' }));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const hasAnything = Object.keys(answers).length > 0 || Boolean(respondent.familyId || respondent.memberId);

  useEffect(() => {
    if (!started || submitted || survey?.fillState !== 'open') return;
    const timer = window.setInterval(() => {
      if (hasAnything && snapshot() !== lastSaved.current) void saveDraft(true);
    }, AUTOSAVE_MS);
    return () => window.clearInterval(timer);
  });

  useEffect(() => {
    if (submitted || !hasAnything || snapshot() === lastSaved.current) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [submitted, hasAnything, snapshot]);

  /* ---------------------------------------------------------------- navigation ---- */

  const pageOfKey = (key: string) => {
    const fid = fieldIdFromKey(key);
    return content ? content.pages.findIndex((p) => p.fields.some((f) => f.id === fid)) : -1;
  };

  const focusFirstError = (found: Record<string, string>) => {
    const first = Object.keys(found)[0];
    if (!first) return;
    window.setTimeout(() => document.getElementById(`survey-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50);
  };

  const next = () => {
    if (!content) return;
    const page = content.pages[pageIndex];
    const found = validateAnswers(content, answers, { pageId: page.id });
    setErrors(found);
    if (Object.keys(found).length) {
      toast.error('Please correct the highlighted answers.');
      focusFirstError(found);
      return;
    }
    setPageIndex((i) => Math.min(i + 1, content.pages.length - 1));
    document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async () => {
    if (!content) return;
    if (respondentType !== 'none' && !respondent.familyId && !respondent.memberId) {
      setRespondentError(`Please choose the ${respondentType} this response is about.`);
      document.getElementById('main-content')?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const found = validateAnswers(content, answers);
    setErrors(found);
    if (Object.keys(found).length) {
      const firstPage = pageOfKey(Object.keys(found)[0]);
      if (firstPage >= 0) setPageIndex(firstPage);
      toast.error('Please correct the highlighted answers.');
      focusFirstError(found);
      return;
    }
    try {
      setSubmitting(true);
      if (draftId) await surveyFormService.updateSubmission(draftId, payload(true));
      else await surveyFormService.createSubmission(id, payload(true));
      setSubmitted(true);
    } catch (err) {
      const serverErrors = (err as { response?: { data?: { errors?: Record<string, string> } } })?.response?.data?.errors;
      if (serverErrors && typeof serverErrors === 'object') {
        setErrors(serverErrors);
        const firstPage = pageOfKey(Object.keys(serverErrors)[0]);
        if (firstPage >= 0) setPageIndex(firstPage);
      }
      toast.error(errorMessage(err, { action: 'submit the response' }));
    } finally {
      setSubmitting(false);
    }
  };

  const discardDraft = async () => {
    if (!draftId) return;
    try {
      await surveyFormService.removeSubmission(draftId);
      lastSaved.current = snapshot();
      toast.success('Draft deleted');
      navigate(`/survey/${id}?tab=mine`, { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, { action: 'delete the draft' }));
    } finally {
      setConfirmDiscard(false);
    }
  };

  const startAnother = () => {
    setAnswers({});
    setErrors({});
    setRespondent(EMPTY_RESPONDENT);
    setDraftId(undefined);
    setPageIndex(0);
    setSubmitted(false);
    setSavedAt(null);
    lastSaved.current = '';
    navigate(`/survey/${id}/fill`, { replace: true });
  };

  /* ---------------------------------------------------------------- render ---- */

  if (loadError) {
    return <EmptyState variant="error" entity="survey form" description={loadError} action={{ label: 'Back to survey', onClick: () => navigate(`/survey/${id}`) }} />;
  }
  if (!survey || !content) return <PageSkeleton variant="section" />;

  if (survey.fillState !== 'open') {
    return (
      <EmptyState
        variant="info"
        title={FILL_STATE_LABELS[survey.fillState]}
        description="This survey is not taking new responses right now."
        action={{ label: 'Back to survey', onClick: () => navigate(`/survey/${id}`) }}
      />
    );
  }

  if (submitted) {
    return (
      <Card className="mx-auto max-w-lg py-10 text-center">
        <FiCheckCircle className="mx-auto h-12 w-12 text-emerald-500" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-semibold">Response submitted</h1>
        <p className="mt-1 text-sm text-muted-foreground">It is now waiting for review by the Mahallu admin.</p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => navigate(`/survey/${id}?tab=mine`)}>
            Back to survey
          </Button>
          <Button onClick={startAnother}>Fill another</Button>
        </div>
      </Card>
    );
  }

  const header = (
    <PageHeader
      eyebrow={draftId ? 'Draft response' : 'New response'}
      title={survey.title}
      description={survey.description}
      actions={
        <>
          <Link to={`/survey/${id}`}>
            <Button variant="ghost" icon={<FiArrowLeft />} collapseLabel>
              Survey
            </Button>
          </Link>
          {draftId && (
            <Button variant="outline" icon={<FiTrash2 />} collapseLabel onClick={() => setConfirmDiscard(true)}>
              Delete draft
            </Button>
          )}
        </>
      }
    />
  );

  if (!started) {
    return (
      <div className="space-y-4">
        {header}
        <Card className="mx-auto max-w-2xl">
          {content.instructions.length > 0 ? (
            <>
              <h2 className="text-base font-semibold">Before you start</h2>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-foreground/90">
                {content.instructions.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ol>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {content.pages.length} page{content.pages.length === 1 ? '' : 's'}. Your answers are saved as a draft every 30 seconds.
            </p>
          )}
          <Button className="mt-4 w-full sm:w-auto" onClick={() => setStarted(true)}>
            {content.instructions.length > 0 ? 'I understand, start the form' : 'Start'}
          </Button>
        </Card>
      </div>
    );
  }

  const page = content.pages[pageIndex];
  const isLast = pageIndex === content.pages.length - 1;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {header}

      {respondentType !== 'none' && (
        <Card>
          <SearchableSelect
            label={respondentType === 'family' ? 'Family (household) this response is about' : 'Member this response is about'}
            required
            placeholder={respondentType === 'family' ? 'Search by house name or head…' : 'Search by name…'}
            value={respondent.familyId && respondentType === 'family' ? respondent.familyId : respondent.memberId}
            error={respondentError}
            options={
              respondent.option && !respondentOptions.some((o) => o.value === respondent.option?.value)
                ? [respondent.option, ...respondentOptions]
                : respondentOptions
            }
            onSearch={(q) => void searchRespondents(q)}
            isLoading={searching}
            onChange={(v) => void pickRespondent(v)}
            helperText="Questions linked to the record fill in automatically. You can still change them."
          />
        </Card>
      )}

      <Card>
        {content.pages.length > 1 && (
          <div className="mb-4">
            <Stepper
              steps={content.pages.map((p) => ({ id: String(p.id), label: p.title || 'Untitled' }))}
              current={pageIndex}
              maxVisited={pageIndex}
              onStepClick={(i) => i < pageIndex && setPageIndex(i)}
            />
          </div>
        )}
        <div className="mb-4">
          <p className="text-xs font-medium text-muted-foreground">
            Page {pageIndex + 1} of {content.pages.length}
          </p>
          <h2 className="text-base font-semibold text-foreground">{page.title}</h2>
          {page.description && <p className="mt-0.5 text-sm text-muted-foreground">{page.description}</p>}
        </div>
        <SurveyPageFields
          page={page}
          content={content}
          answers={answers}
          visible={visible}
          errors={errors}
          onChange={(key, value) => {
            setAnswers((prev) => ({ ...prev, [key]: value }));
            if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
          }}
        />
      </Card>

      <div className="sticky bottom-20 z-20 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-lg backdrop-blur md:bottom-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            {saving ? 'Saving draft…' : savedAt ? `Draft saved at ${savedAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Not saved yet'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button variant="ghost" icon={<FiSave />} onClick={() => void saveDraft()} disabled={saving || submitting}>
              Save draft
            </Button>
            <Button variant="outline" disabled={pageIndex === 0 || submitting} onClick={() => setPageIndex((i) => i - 1)}>
              Previous
            </Button>
            {isLast ? (
              <Button onClick={submit} isLoading={submitting} loadingText="Submitting">
                Submit
              </Button>
            ) : (
              <Button onClick={next}>Next</Button>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDiscard}
        title="Delete this draft?"
        message="The answers saved in this draft will be removed. This cannot be undone."
        confirmLabel="Delete draft"
        variant="danger"
        onConfirm={discardDraft}
        onCancel={() => setConfirmDiscard(false)}
      />
    </div>
  );
}

