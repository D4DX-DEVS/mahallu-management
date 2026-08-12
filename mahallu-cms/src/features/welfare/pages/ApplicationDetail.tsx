import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { welfareService, WelfareApplication, WelfareStatus } from '@/services/welfareService';

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
      setNote('');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Status change rejected');
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
          <Button variant="outline" className="mt-4">
            Back to applications
          </Button>
        </Link>
      </Card>
    );
  }

  const nextOptions = NEXT_STATUSES[application.status] || [];

  const infoCards = [
    { label: 'Scheme', value: nameOf(application.schemeId, 'name') },
    { label: 'Family', value: nameOf(application.familyId, 'houseName') },
    { label: 'Requested', value: `Rs ${application.requestedAmount}` },
    { label: 'Approved', value: application.approvedAmount ? `Rs ${application.approvedAmount}` : '-' },
    { label: 'Priority', value: application.priority },
    { label: 'Status', value: STATUS_LABELS[application.status] },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Welfare Application</h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Raised {formatDate(application.createdAt)}
          </p>
        </div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Welfare', path: '/welfare/applications' },
            { label: 'Application' },
          ]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {infoCards.map((card) => (
          <Card key={card.label} className="p-3 sm:p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 sm:text-sm">{card.label}</p>
            <p className="mt-1 break-words text-sm font-semibold text-gray-900 dark:text-gray-100 sm:text-base">
              {card.value}
            </p>
          </Card>
        ))}
      </div>

      {application.reason && (
        <Card className="p-3 sm:p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Reason</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{application.reason}</p>
        </Card>
      )}

      {nextOptions.length > 0 && (
        <Card className="p-3 sm:p-4">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Move to</h2>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {nextOptions.map((status) => (
              <Button
                key={status}
                size="md"
                variant={status === 'rejected' ? 'outline' : 'primary'}
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

      <Card className="p-3 sm:p-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Timeline</h2>
        <ol className="mt-2 space-y-2">
          {(application.history || []).map((entry, index) => (
            <li key={index} className="flex items-start gap-2">
              <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary-500" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {STATUS_LABELS[entry.status] || entry.status}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatDate(entry.changedAt)}
                  {entry.note ? ` - ${entry.note}` : ''}
                </p>
              </div>
            </li>
          ))}
          {(application.history || []).length === 0 && (
            <li className="text-sm text-gray-500 dark:text-gray-400">No status changes yet</li>
          )}
        </ol>
      </Card>

      <Modal
        isOpen={target !== null}
        onClose={() => setTarget(null)}
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
            <Button variant="outline" onClick={() => setTarget(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={applyStatus} disabled={saving}>
              {saving ? 'Saving...' : 'Confirm'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
