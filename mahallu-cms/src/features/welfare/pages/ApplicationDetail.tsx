import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Avatar, { PersonCell } from '@/components/ui/Avatar';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { welfareService, WelfareApplication, WelfareStatus } from '@/services/welfareService';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

/** Mirrors WELFARE_TRANSITIONS on the API - the server is still the authority. */
const NEXT_STATUSES: Record<WelfareStatus, WelfareStatus[]> = {
  pending: ['verified', 'rejected'],
  verified: ['approved', 'rejected'],
  approved: ['disbursed', 'rejected'],
  disbursed: ['closed'],
  rejected: [],
  closed: [],
};

const STATUS_LABELS: Record<WelfareStatus, string> = {
  pending: 'Pending',
  verified: 'Verified',
  approved: 'Approved',
  rejected: 'Rejected',
  disbursed: 'Disbursed',
  closed: 'Closed',
};

const nameOf = (value: any, key: string) => (typeof value === 'object' && value ? value[key] : '-');
const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString() : '-');

export default function ApplicationDetail() {
  const { id } = useParams<{ id: string }>();
  const [application, setApplication] = useState<WelfareApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<WelfareStatus | null>(null);
  const [approvedAmount, setApprovedAmount] = useState('');
  const [note, setNote] = useState('');
  const [disbursedVia, setDisbursedVia] = useState('cash');
  const [saving, setSaving] = useState(false);
  const [isConfirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    welfareService
      .getApplication(id)
      .then(setApplication)
      .catch(() => setApplication(null))
      .finally(() => setLoading(false));
  }, [id]);

  const applyStatus = async () => {
    if (!id || !target) return;
    try {
      setSaving(true);
      const payload: Record<string, any> = { status: target, note };
      if (target === 'approved') payload.approvedAmount = Number(approvedAmount || 0);
      if (target === 'disbursed') payload.disbursedVia = disbursedVia;
      if (target === 'verified') payload.verificationNotes = note;
      const updated = await welfareService.updateStatus(id, payload);
      setApplication(updated);
      setTarget(null);
      setConfirmOpen(false);
      setNote('');
      toast.success(`Application moved to ${STATUS_LABELS[target]}`);
    } catch (err: any) {
      toast.error(getFriendlyError(err, 'Status change rejected. Try again in a moment.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!application) {
    return (
      <Card>
        <p className="text-red-600 dark:text-red-400">Application not found</p>
        <Link to="/welfare/applications">
          <Button variant="secondary" className="mt-4">
            Back to applications
          </Button>
        </Link>
      </Card>
    );
  }

  const nextOptions = NEXT_STATUSES[application.status] || [];

  const infoCards = [
    { label: 'Scheme', value: nameOf(application.schemeId, 'name') === '-' ? '-' : <PersonCell name={nameOf(application.schemeId, 'name')} size={24} /> },
    { label: 'Family', value: nameOf(application.familyId, 'houseName') === '-' ? '-' : <PersonCell name={nameOf(application.familyId, 'houseName')} size={24} /> },
    { label: 'Requested', value: `Rs ${application.requestedAmount}` },
    { label: 'Approved', value: application.approvedAmount ? `Rs ${application.approvedAmount}` : '-' },
    { label: 'Priority', value: application.priority ? <StatusBadge status={application.priority} tone={application.priority === 'urgent' || application.priority === 'high' ? 'warning' : application.priority === 'medium' ? 'info' : 'neutral'} /> : '-' },
    { label: 'Status', value: <StatusBadge status={application.status} label={STATUS_LABELS[application.status]} /> },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        leading={<Avatar size={56} name={nameOf(application.familyId, 'houseName') === '-' ? '' : nameOf(application.familyId, 'houseName')} />}
        title={
          <span className="inline-flex flex-wrap items-center gap-2.5">
            Welfare application
            <StatusBadge status={application.status} label={STATUS_LABELS[application.status]} />
          </span>
        }
        description={<>Raised {formatDate(application.createdAt)}</>}
      />

      <Card>
        <dl className="grid grid-cols-1 gap-x-4 gap-y-3.5 break-words min-[420px]:grid-cols-2 md:grid-cols-3">
          {infoCards.map((card) => (
            <div key={card.label} className="min-w-0">
              <dt className="text-[12px] font-bold uppercase tracking-wider text-[#7B8983] dark:text-surface-muted">{card.label}</dt>
              <dd className="mt-0.5 break-words text-[13px] font-semibold text-[#18231E] dark:text-surface-text">{card.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {application.reason && (
        <Card>
          <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Reason</h2>
          <p className="mt-1 text-sm text-[#5B6963] dark:text-surface-muted">{application.reason}</p>
        </Card>
      )}

      {nextOptions.length > 0 && (
        <Card>
          <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Move to</h2>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {nextOptions.map((status) => (
              <Button
                key={status}
                variant={status === 'rejected' ? 'danger' : 'primary'}
                onClick={() => {
                  setTarget(status);
                  setApprovedAmount(String(application.requestedAmount));
                }}
              >
                {STATUS_LABELS[status]}
              </Button>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Timeline</h2>
        <ol className="mt-2 space-y-2">
          {(application.history || []).map((entry, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary-600 dark:bg-brand-lime" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#18231E] dark:text-surface-text">
                  {STATUS_LABELS[entry.status] || entry.status}
                </p>
                <p className="text-xs text-[#7B8983] dark:text-surface-muted">
                  {formatDate(entry.changedAt)}
                  {entry.note ? ` - ${entry.note}` : ''}
                </p>
              </div>
            </li>
          ))}
          {(application.history || []).length === 0 && (
            <li className="text-sm text-[#7B8983] dark:text-surface-muted">No status changes yet</li>
          )}
        </ol>
      </Card>

      <ConfirmDialog
        isOpen={isConfirmOpen}
        title={target ? `Move to ${STATUS_LABELS[target]}` : ''}
        message={target ? `Change status to ${STATUS_LABELS[target]}?` : ''}
        onConfirm={applyStatus}
        onCancel={() => {
          setConfirmOpen(false);
          setTarget(null);
          setNote('');
        }}
        isLoading={saving}
      />

      <Modal
        isOpen={target !== null && !isConfirmOpen}
        onClose={() => {
          setTarget(null);
          setNote('');
        }}
        title={target ? `Move to ${STATUS_LABELS[target]}` : ''}
      >
        <div className="space-y-3">
          {target === 'approved' && (
            <Input
              label="Approved Amount"
              type="number"
              value={approvedAmount}
              onChange={(e) => setApprovedAmount(e.target.value)}
              helperText={`Requested: Rs ${application.requestedAmount}`}
            />
          )}

          {target === 'disbursed' && (
            <Select
              label="Disbursed Via"
              value={disbursedVia}
              onChange={(e) => setDisbursedVia(e.target.value)}
              options={[
                { value: 'cash', label: 'Cash' },
                { value: 'bank', label: 'Bank transfer' },
                { value: 'ledger', label: 'Ledger (posts an expense entry)' },
              ]}
            />
          )}

          <Input label="Note" value={note} onChange={(e) => setNote(e.target.value)} />

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={saving}>
              {saving ? 'Saving...' : 'Confirm'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
