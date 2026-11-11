import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { FiEdit2, FiLayout, FiLock, FiUnlock, FiTrash2, FiEdit3 } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Tabs from '@/components/ui/Tabs';
import StatusBadge from '@/components/ui/StatusBadge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import ActionsMenu from '@/components/ui/ActionsMenu';
import { PageSkeleton } from '@/components/ui/Skeleton';
import PageHeader from '@/components/layout/PageHeader';
import { surveyFormService, SurveyForm, FILL_STATE_LABELS, RESPONDENT_OPTIONS, surveyTypeLabel } from '@/services/surveyFormService';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import SubmissionsTab from '../components/SubmissionsTab';
import MyResponsesTab from '../components/MyResponsesTab';
import { useSurveyAccess } from '../useSurveyAccess';
import { formatDay, formatPeriod, surveyBadge } from '../surveyDisplay';

/** One survey: its details and progress, its responses (admins) and the caller's own responses. */
export default function SurveyOverview() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin } = useSurveyAccess();
  const [survey, setSurvey] = useState<SurveyForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'close' | 'reopen' | 'delete' | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setError(null);
    surveyFormService
      .get(id)
      .then(setSurvey)
      .catch((err) => setError(loadErrorMessage(err, 'survey')));
  }, [id]);

  useEffect(load, [load]);

  if (error) return <EmptyState variant="error" entity="survey" description={error} action={{ label: 'Back to surveys', onClick: () => navigate('/survey') }} />;
  if (!survey) return <PageSkeleton variant="section" />;

  const tabs = isAdmin
    ? [
        { value: 'responses', label: 'Submissions', count: survey.counts?.responses },
        { value: 'mine', label: 'My responses' },
      ]
    : [{ value: 'mine', label: 'My responses', count: (survey.counts?.responses || 0) + (survey.counts?.draft || 0) }];
  const tab = tabs.some((t) => t.value === searchParams.get('tab')) ? (searchParams.get('tab') as string) : tabs[0].value;

  const runAction = async () => {
    if (!confirm) return;
    try {
      setBusy(true);
      if (confirm === 'delete') {
        await surveyFormService.remove(id);
        toast.success('Survey deleted');
        navigate('/survey', { replace: true });
        return;
      }
      const updated = await surveyFormService.setStatus(id, confirm === 'close' ? 'closed' : 'published');
      setSurvey((prev) => (prev ? { ...prev, ...updated } : updated));
      toast.success(confirm === 'close' ? 'Survey closed to new responses' : 'Survey reopened');
    } catch (err) {
      toast.error(errorMessage(err, { action: `${confirm} the survey` }));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const badge = surveyBadge(survey.fillState);
  const responses = survey.counts?.responses || 0;
  const pct = survey.targetCount ? Math.min(100, Math.round((responses / survey.targetCount) * 100)) : null;
  const respondent = RESPONDENT_OPTIONS.find((o) => o.value === survey.respondentType);

  const facts = [
    { label: 'Status', value: <StatusBadge status={badge.status} label={badge.label} /> },
    { label: 'Period', value: formatPeriod(survey.startDate, survey.endDate) },
    { label: 'Each response is about', value: respondent?.label || 'General' },
    {
      label: 'Form',
      value: survey.publishedVersion ? (
        <>
          Version {survey.publishedVersion}
          <span className="block text-xs font-normal text-muted-foreground">published {formatDay(survey.publishedAt)}</span>
        </>
      ) : (
        'Not published'
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={surveyTypeLabel(survey.type)}
        title={survey.title}
        description={survey.description}
        actions={
          <>
            {survey.fillState === 'open' && (
              <Button icon={<FiEdit3 />} collapseLabel onClick={() => navigate(`/survey/${id}/fill`)}>
                Fill form
              </Button>
            )}
            {isAdmin && (
              <>
                <Link to={`/survey/${id}/builder`}>
                  <Button variant="outline" icon={<FiLayout />} collapseLabel>
                    Configure form
                  </Button>
                </Link>
                <ActionsMenu
                  items={[
                    { label: 'Edit details', icon: <FiEdit2 />, onClick: () => navigate(`/survey/${id}/edit`) },
                    ...(survey.status === 'published'
                      ? [{ label: 'Close survey', icon: <FiLock />, onClick: () => setConfirm('close') }]
                      : survey.status === 'closed'
                        ? [{ label: 'Reopen survey', icon: <FiUnlock />, onClick: () => setConfirm('reopen') }]
                        : []),
                    { label: 'Delete survey', icon: <FiTrash2 />, onClick: () => setConfirm('delete'), variant: 'danger' as const },
                  ]}
                />
              </>
            )}
          </>
        }
      />

      {isAdmin && survey.status === 'draft' && (
        <Card className="border-l-4 border-amber-500">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Not published yet</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Survey workers can't see this survey until its form is published.{' '}
            <Link className="font-medium text-primary hover:underline" to={`/survey/${id}/builder`}>
              Configure and publish the form
            </Link>
          </p>
        </Card>
      )}
      {isAdmin && survey.hasUnpublishedChanges && survey.status !== 'draft' && (
        <Card className="border-l-4 border-amber-500">
          <p className="text-sm text-muted-foreground">
            The form has saved edits that are not published yet. Survey workers still fill version {survey.publishedVersion}.{' '}
            <Link className="font-medium text-primary hover:underline" to={`/survey/${id}/builder`}>
              Review and publish
            </Link>
          </p>
        </Card>
      )}
      {!isAdmin && survey.fillState !== 'open' && (
        <Card className="border-l-4 border-border">
          <p className="text-sm text-muted-foreground">{FILL_STATE_LABELS[survey.fillState]}: new responses are not being taken right now.</p>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {facts.map((fact) => (
          <Card key={fact.label}>
            <p className="text-xs font-medium text-muted-foreground">{fact.label}</p>
            <div className="mt-1 text-sm font-semibold text-foreground">{fact.value}</div>
          </Card>
        ))}
      </div>

      {isAdmin && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card>
            <p className="text-xs font-medium text-muted-foreground">Responses</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {responses}
              {survey.targetCount ? <span className="text-sm font-normal text-muted-foreground"> / {survey.targetCount}</span> : null}
            </p>
            {pct !== null && (
              <div className="mt-2 h-1.5 rounded-full bg-subtle" aria-label={`${pct}% of target`}>
                <div className="h-1.5 rounded-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            )}
          </Card>
          {[
            { label: 'Pending review', value: survey.counts?.pending || 0, tone: 'text-amber-600 dark:text-amber-400' },
            { label: 'Accepted', value: survey.counts?.accepted || 0, tone: 'text-emerald-600 dark:text-emerald-400' },
            { label: 'Rejected', value: survey.counts?.rejected || 0, tone: 'text-red-600 dark:text-red-400' },
          ].map((stat) => (
            <Card key={stat.label}>
              <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${stat.tone}`}>{stat.value}</p>
            </Card>
          ))}
        </div>
      )}

      <Tabs ariaLabel="Survey responses" value={tab} onChange={(v) => setSearchParams({ tab: v }, { replace: true })} items={tabs} />
      {tab === 'responses' && isAdmin ? <SubmissionsTab survey={survey} /> : <MyResponsesTab survey={survey} />}

      <ConfirmDialog
        isOpen={confirm !== null}
        title={confirm === 'delete' ? 'Delete this survey?' : confirm === 'close' ? 'Close this survey?' : 'Reopen this survey?'}
        message={
          confirm === 'delete'
            ? 'The survey, its form and any unsubmitted drafts will be removed. This cannot be undone.'
            : confirm === 'close'
              ? 'Survey workers will no longer be able to submit responses. Existing responses stay available for review.'
              : 'Survey workers can submit responses again, within the survey period.'
        }
        consequence={confirm === 'delete' && responses > 0 ? `It has ${responses} submitted response(s), so the server will refuse; close it instead.` : undefined}
        confirmLabel={confirm === 'delete' ? 'Delete survey' : confirm === 'close' ? 'Close survey' : 'Reopen survey'}
        variant={confirm === 'delete' || confirm === 'close' ? 'danger' : 'primary'}
        isLoading={busy}
        onConfirm={runAction}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
