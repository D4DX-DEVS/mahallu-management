import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiCheck, FiTrash2, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Textarea from '@/components/ui/Textarea';
import StatusBadge from '@/components/ui/StatusBadge';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import { PageSkeleton } from '@/components/ui/Skeleton';
import PageHeader from '@/components/layout/PageHeader';
import { ROUTES } from '@/constants/routes';
import { surveyFormService, SurveyForm, SurveySubmission, FormVersion } from '@/services/surveyFormService';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import SurveyAnswersView from '../components/SurveyAnswersView';
import { useSurveyAccess } from '../useSurveyAccess';
import { SUBMISSION_STATUS_LABELS, formatDateTime } from '../surveyDisplay';

type Decision = 'accepted' | 'rejected';

const refOf = (value: SurveySubmission['familyId'] | SurveySubmission['memberId']) =>
  value && typeof value === 'object' ? value : null;

/** One response, read against the form version it was filled on. Admins accept or reject it here. */
export default function SubmissionDetail() {
  const { id = '', subId = '' } = useParams<{ id: string; subId: string }>();
  const navigate = useNavigate();
  const { isAdmin } = useSurveyAccess();
  const [data, setData] = useState<{ submission: SurveySubmission; survey: SurveyForm | null; version: FormVersion | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    setError(null);
    surveyFormService
      .getSubmission(subId)
      .then((result) => {
        if (result.submission.status === 'draft' && !isAdmin) {
          navigate(`/survey/${id}/fill/${subId}`, { replace: true });
          return;
        }
        setData(result);
      })
      .catch((err) => setError(loadErrorMessage(err, 'response')));
  }, [id, subId, isAdmin, navigate]);

  useEffect(load, [load]);

  if (error) {
    return <EmptyState variant="error" entity="response" description={error} action={{ label: 'Back to survey', onClick: () => navigate(`/survey/${id}`) }} />;
  }
  if (!data) return <PageSkeleton variant="section" />;

  const { submission, survey, version } = data;
  const family = refOf(submission.familyId);
  const member = refOf(submission.memberId);
  const backTab = isAdmin ? 'responses' : 'mine';

  const review = async () => {
    if (!decision) return;
    if (decision === 'rejected' && !note.trim()) {
      setNoteError('Please say why it is rejected, so the surveyor can act on it.');
      return;
    }
    try {
      setSaving(true);
      const updated = await surveyFormService.review(subId, decision, note.trim());
      setData((prev) => (prev ? { ...prev, submission: { ...prev.submission, ...updated, familyId: prev.submission.familyId, memberId: prev.submission.memberId } } : prev));
      toast.success(decision === 'accepted' ? 'Response accepted' : 'Response rejected');
      setDecision(null);
      setNote('');
    } catch (err) {
      toast.error(errorMessage(err, { action: 'save the review' }));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await surveyFormService.removeSubmission(subId);
      toast.success('Response deleted');
      navigate(`/survey/${id}?tab=${backTab}`, { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, { action: 'delete the response' }));
      setConfirmDelete(false);
    }
  };

  const facts = [
    {
      label: survey?.respondentType === 'member' ? 'Member' : 'Family',
      value: member ? (
        <Link className="text-primary hover:underline" to={ROUTES.MEMBERS.DETAIL(member.id)}>
          {String(member.name || submission.respondentName || 'Member')}
        </Link>
      ) : family ? (
        <Link className="text-primary hover:underline" to={ROUTES.FAMILIES.DETAIL(family.id)}>
          {[family.houseName, family.familyHead].filter(Boolean).join(' - ') || submission.respondentName}
        </Link>
      ) : (
        submission.respondentName || '—'
      ),
      hidden: survey?.respondentType === 'none',
    },
    { label: 'Surveyor', value: submission.submittedByName || '—' },
    { label: 'Submitted', value: formatDateTime(submission.submittedAt) },
    { label: 'Form version', value: `Version ${submission.version}` },
  ].filter((f) => !f.hidden);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={survey?.title || 'Survey response'}
        title={submission.respondentName || 'Survey response'}
        actions={
          <>
            <Link to={`/survey/${id}?tab=${backTab}`}>
              <Button variant="ghost" icon={<FiArrowLeft />} collapseLabel>
                Back
              </Button>
            </Link>
            {isAdmin && (
              <Button variant="outline" icon={<FiTrash2 />} collapseLabel onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
          </>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge status={submission.status} label={SUBMISSION_STATUS_LABELS[submission.status]} size="md" />
            {submission.reviewedAt && (
              <span className="text-xs text-muted-foreground">
                by {submission.reviewedByName || 'admin'} on {formatDateTime(submission.reviewedAt)}
              </span>
            )}
          </div>
          {isAdmin && submission.status !== 'draft' && (
            <div className="flex gap-2">
              {submission.status !== 'rejected' && (
                <Button variant="outline" icon={<FiX />} onClick={() => setDecision('rejected')}>
                  {submission.status === 'accepted' ? 'Reject instead' : 'Reject'}
                </Button>
              )}
              {submission.status !== 'accepted' && (
                <Button icon={<FiCheck />} onClick={() => setDecision('accepted')}>
                  {submission.status === 'rejected' ? 'Accept instead' : 'Accept'}
                </Button>
              )}
            </div>
          )}
        </div>
        {submission.reviewNote && (
          <p className="mt-3 rounded-lg bg-subtle px-3 py-2 text-sm">
            <span className="font-medium">Review note: </span>
            {submission.reviewNote}
          </p>
        )}
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {facts.map((fact) => (
          <Card key={fact.label}>
            <p className="text-xs font-medium text-muted-foreground">{fact.label}</p>
            <div className="mt-1 break-words text-sm font-semibold text-foreground">{fact.value}</div>
          </Card>
        ))}
      </div>

      {version ? (
        <SurveyAnswersView content={version.content} answers={submission.answers || {}} submissionId={submission.id} />
      ) : (
        <EmptyState variant="error" title="Form version missing" description="The form this response was filled on could not be found." />
      )}

      {(submission.history || []).length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-foreground">History</h2>
          <ol className="mt-2 space-y-2">
            {(submission.history || []).map((entry, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {entry.status === 'pending' ? 'Submitted' : SUBMISSION_STATUS_LABELS[entry.status]}
                    {entry.byName ? <span className="font-normal text-muted-foreground"> by {entry.byName}</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(entry.at)}
                    {entry.note ? ` — ${entry.note}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      )}

      <Modal
        isOpen={decision !== null}
        onClose={() => {
          setDecision(null);
          setNote('');
          setNoteError('');
        }}
        title={decision === 'accepted' ? 'Accept this response?' : 'Reject this response?'}
        size="sm"
      >
        <div className="space-y-3">
          <Textarea
            label={decision === 'rejected' ? 'Reason' : 'Note (optional)'}
            required={decision === 'rejected'}
            rows={3}
            value={note}
            error={noteError}
            maxLength={1000}
            helperText="The surveyor sees this note on their response."
            onChange={(e) => {
              setNote(e.target.value);
              setNoteError('');
            }}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setDecision(null)} disabled={saving}>
              Cancel
            </Button>
            <Button variant={decision === 'rejected' ? 'danger' : 'primary'} onClick={review} isLoading={saving} loadingText="Saving">
              {decision === 'accepted' ? 'Accept response' : 'Reject response'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete this response?"
        message="The response and its answers will be permanently removed. This cannot be undone."
        confirmLabel="Delete response"
        variant="danger"
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
