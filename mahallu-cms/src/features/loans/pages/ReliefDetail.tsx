import { useState, useEffect, ReactNode } from 'react';
import { FiTrash2 } from 'react-icons/fi';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { toast } from '@/store/toastStore';
import { formatCurrency, formatDate } from '@/utils/format';
import { reliefService, ReliefCase, ReliefStatus, RELIEF_TRANSITIONS } from '@/services/qardService';
import { ReliefStatusBadge, UrgencyBadge } from '../components/LoanStatusBadge';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';
import PageHeader from '@/components/layout/PageHeader';

const Field = ({ label, value }: { label: string; value: ReactNode }) => (
  <div>
    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{value ?? '-'}</p>
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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      setError(loadErrorMessage(err, 'the case'));
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
      setActionError(errorMessage(err, { action: 'update the case' }));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      setDeleting(true);
      await reliefService.deleteCase(id);
      toast.success('Relief case deleted');
      navigate('/relief');
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete relief case' }));
      setDeleting(false);
    }
  };

  if (loading) return <PageSkeleton />;

  if (error || !reliefCase) {
    return (
      <div>
        <PageHeader title="Emergency Relief" breadcrumbs={[{ label: 'Services' }]} />
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
    <div>
      <PageHeader
        title={reliefCase.title}
        breadcrumbs={[{ label: 'Services' }, { label: 'Emergency Relief', path: '/relief' }]}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <ReliefStatusBadge status={reliefCase.status} />
          <UrgencyBadge urgency={reliefCase.urgency} />
        </div>
        <Button variant="danger" onClick={() => setShowDeleteModal(true)} icon={<FiTrash2 />} collapseLabel>Delete</Button>
      </div>

      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Case</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Title (Malayalam)" value={reliefCase.titleMl || '-'} />
          <Field
            label="Family"
            value={
              reliefCase.familyId && typeof reliefCase.familyId === 'object'
                ? toTitleCase(reliefCase.familyId.houseName)
                : '-'
            }
          />
          <Field
            label="Member"
            value={
              reliefCase.memberId && typeof reliefCase.memberId === 'object'
                ? toTitleCase(reliefCase.memberId.name)
                : '-'
            }
          />
          <Field label="Reported" value={formatDate(reliefCase.createdAt)} />
          <Field
            label="Follow-up"
            value={reliefCase.followUpDate ? formatDate(reliefCase.followUpDate) : '-'}
          />
          <Field label="Assistance" value={reliefCase.amount ? formatCurrency(reliefCase.amount) : '-'} />
          <div className="col-span-2 sm:col-span-3 lg:col-span-4">
            <Field label="Description" value={reliefCase.description || '-'} />
          </div>
          <div className="col-span-2 sm:col-span-3 lg:col-span-4">
            <Field label="Assistance given" value={reliefCase.assistanceGiven || '-'} />
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-foreground">Move this case</h2>

        {options.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            A closed case cannot be moved any further.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:items-end">
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
          <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {actionError}
          </div>
        )}
      </Card>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Relief Case"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          Are you sure you want to delete <strong>{reliefCase.title}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
