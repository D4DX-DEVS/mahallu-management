import { useState, useEffect, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Avatar, { PersonCell } from '@/components/ui/Avatar';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import { formatCurrency, formatDate } from '@/utils/format';
import { reliefService, ReliefCase, ReliefStatus, RELIEF_TRANSITIONS } from '@/services/qardService';
import { ReliefStatusBadge, UrgencyBadge } from '../components/LoanStatusBadge';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const Field = ({ label, value }: { label: string; value: ReactNode }) => (
  <div>
    <p className="text-[12px] font-bold uppercase tracking-wider text-[#7B8983] dark:text-surface-muted">{label}</p>
    <div className="text-[13px] font-semibold text-[#18231E] dark:text-surface-text">{value ?? '-'}</div>
  </div>
);

export default function ReliefDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [reliefCase, setReliefCase] = useState<ReliefCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [nextStatus, setNextStatus] = useState<ReliefStatus | ''>('');
  const [assistanceGiven, setAssistanceGiven] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (id) fetchCase(id);
  }, [id]);

  const fetchCase = async (caseId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await reliefService.getCase(caseId);
      setReliefCase(data);
      setAssistanceGiven(data.assistanceGiven || '');
      setAmount(data.amount ? String(data.amount) : '');
      setNextStatus((RELIEF_TRANSITIONS[data.status] || [])[0] ?? '');
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load the case. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  const moveStatus = async () => {
    if (!reliefCase || !nextStatus) return;
    try {
      setSaving(true);
      setActionError(null);
      const payload: Record<string, any> = { status: nextStatus };
      if (assistanceGiven) payload.assistanceGiven = assistanceGiven;
      if (amount) payload.amount = Number(amount);
      await reliefService.updateCaseStatus(reliefCase.id, payload);
      if (id) fetchCase(id);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't update the case. Try again in a moment."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (error || !reliefCase) {
    return (
      <div className="space-y-4">
        <Card>
          <p className="text-sm text-red-600 dark:text-red-400">{error || 'Case not found'}</p>
          <Button className="mt-3" variant="secondary" onClick={() => navigate('/relief')}>
            Back to relief cases
          </Button>
        </Card>
      </div>
    );
  }

  const options = RELIEF_TRANSITIONS[reliefCase.status] || [];
  const assisting = nextStatus === 'assisted';

  return (
    <div className="space-y-4">
      <PageHeader
        leading={<Avatar size={56} name={reliefCase.familyId && typeof reliefCase.familyId === 'object' ? reliefCase.familyId.houseName : reliefCase.title} />}
        title={
          <span className="inline-flex flex-wrap items-center gap-2.5">
            {reliefCase.title}
            <ReliefStatusBadge status={reliefCase.status} />
            <UrgencyBadge urgency={reliefCase.urgency} />
          </span>
        }
        description="Emergency relief case"
      />

      <Card>
        <h2 className="mb-3.5 text-sm font-bold text-[#18231E] dark:text-surface-text">Case</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Title (Malayalam)" value={reliefCase.titleMl || '-'} />
          <Field
            label="Family"
            value={
              reliefCase.familyId && typeof reliefCase.familyId === 'object'
                ? <PersonCell name={reliefCase.familyId.houseName} size={24} />
                : '-'
            }
          />
          <Field
            label="Member"
            value={
              reliefCase.memberId && typeof reliefCase.memberId === 'object'
                ? <PersonCell name={reliefCase.memberId.name} src={(reliefCase.memberId as { photoUrl?: string }).photoUrl} size={24} />
                : '-'
            }
          />
          <Field label="Reported" value={formatDate(reliefCase.createdAt)} />
          <Field
            label="Follow-up"
            value={reliefCase.followUpDate ? formatDate(reliefCase.followUpDate) : '-'}
          />
          <Field
            label="Assistance"
            value={reliefCase.amount ? formatCurrency(reliefCase.amount) : '-'}
          />
          <div className="col-span-2 sm:col-span-3 lg:col-span-4">
            <Field label="Description" value={reliefCase.description || '-'} />
          </div>
          <div className="col-span-2 sm:col-span-3 lg:col-span-4">
            <Field label="Assistance given" value={reliefCase.assistanceGiven || '-'} />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3.5 text-sm font-bold text-[#18231E] dark:text-surface-text">
          Move this case
        </h2>

        {options.length === 0 ? (
          <p className="text-sm text-[#7B8983] dark:text-surface-muted">
            A closed case cannot be moved any further.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
            <Select
              label="New status"
              value={nextStatus}
              onChange={(e) => setNextStatus(e.target.value as ReliefStatus)}
              options={options.map((value) => ({ value, label: value }))}
            />

            <Input
              label="Assistance given"
              value={assistanceGiven}
              onChange={(e) => setAssistanceGiven(e.target.value)}
              placeholder={assisting ? 'Required to mark assisted' : 'Optional'}
            />

            <Input
              label="Amount"
              type="number"
              min={0}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Optional"
            />

            <Button onClick={moveStatus} disabled={!nextStatus || saving}>
              {saving ? 'Saving...' : 'Update'}
            </Button>
          </div>
        )}

        {actionError && (
          <Alert tone="danger" className="mt-3.5">{actionError}</Alert>
        )}
      </Card>
    </div>
  );
}
