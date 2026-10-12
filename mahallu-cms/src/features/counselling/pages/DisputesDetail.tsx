import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiEdit2, FiSave } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { PersonCell } from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Alert from '@/components/ui/Alert';
import Select from '@/components/ui/Select';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import {
  getDisputeCaseById,
  updateDisputeCase,
  IDisputeCase,
} from '@/services/counsellingService';

const STATUSES = ['registered', 'mediation', 'resolved', 'referred', 'closed'];

export default function DisputesDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [caseRecord, setCaseRecord] = useState<IDisputeCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [referredTo, setReferredTo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) fetchCase(id);
  }, [id]);

  const fetchCase = async (caseId: string) => {
    try {
      setLoading(true);
      const response = await getDisputeCaseById(caseId);
      setCaseRecord(response.data);
      setEditStatus(response.data.status);
      setResolutionNotes(response.data.resolutionNotes || '');
      setReferredTo(response.data.referredTo || '');
    } catch (error) {
      console.error('Failed to fetch case:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    try {
      setSaving(true);
      const response = await updateDisputeCase(id, {
        status: editStatus as any,
        resolutionNotes,
        referredTo,
      });
      setCaseRecord(response.data);
      setIsEditing(false);
      toast.success('Dispute case updated');
    } catch (error) {
      console.error('Failed to update case:', error);
      toast.error(getFriendlyError(error, "Couldn't update dispute case. Try again in a moment."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!caseRecord) return <Alert tone="danger">Case not found</Alert>;

  const labelCls = 'text-[12px] font-bold uppercase tracking-[0.04em] text-[#7B8983] dark:text-surface-muted';
  const valueCls = 'mt-0.5 text-[13px] font-semibold text-[#18231E] dark:text-surface-text';

  return (
    <div className="space-y-4">
      <PageHeader
        title={caseRecord.caseNo}
        description="Maslahat dispute case"
        actions={
          <Button variant="secondary" onClick={() => navigate('/maslahat')}>
            Back
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Case Info */}
        <Card padding="lg">
          <h2 className="mb-3.5 text-[13px] font-bold text-[#18231E] dark:text-surface-text">Case Information</h2>
          <div className="space-y-3">
            <div>
              <p className={labelCls}>Case Number</p>
              <p className={valueCls}>{caseRecord.caseNo}</p>
            </div>
            <div>
              <p className={labelCls}>Type</p>
              <p className="mt-1">
                <Badge variant="info" className="capitalize">{caseRecord.type}</Badge>
              </p>
            </div>
            <div>
              <p className={labelCls}>Parties Involved</p>
              <div className="mt-1 space-y-1.5">{caseRecord.parties.map((n, i) => <PersonCell key={`${n}-${i}`} name={n} size={32} />)}</div>
            </div>
            {caseRecord.mediators && caseRecord.mediators.length > 0 && (
              <div>
                <p className={labelCls}>Mediators</p>
                <div className="mt-1 space-y-1.5">{caseRecord.mediators.map((n, i) => <PersonCell key={`${n}-${i}`} name={n} size={32} />)}</div>
              </div>
            )}
          </div>
        </Card>

        {/* Status & Notes */}
        <Card padding="lg">
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Status & Resolution</h2>
            {!isEditing && (
              <Button variant="secondary" iconOnly size="sm" aria-label="Edit status and resolution" onClick={() => setIsEditing(true)}>
                <FiEdit2 size={14} />
              </Button>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-3">
              <Select
                label="Status"
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                options={STATUSES.map((sts) => ({ value: sts, label: sts.charAt(0).toUpperCase() + sts.slice(1) }))}
              />
              <div>
                <label htmlFor="resolution-notes" className={labelClasses}>Resolution Notes</label>
                <textarea
                  id="resolution-notes"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  rows={3}
                  className={`${controlClasses} py-2`}
                />
              </div>
              <Input
                label="Referred To (if applicable)"
                type="text"
                value={referredTo}
                onChange={(e) => setReferredTo(e.target.value)}
                placeholder="Scholar/authority name"
              />
              <div className="flex gap-2 pt-2">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  <FiSave size={14} />
                  Save
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className={labelCls}>Status</p>
                <p className="mt-1">
                  <StatusBadge status={caseRecord.status} />
                </p>
              </div>
              {caseRecord.resolutionNotes && (
                <div>
                  <p className={labelCls}>Resolution Notes</p>
                  <p className="mt-0.5 text-[13px] text-[#3A4741] dark:text-surface-text">{caseRecord.resolutionNotes}</p>
                </div>
              )}
              {caseRecord.referredTo && (
                <div>
                  <p className={labelCls}>Referred To</p>
                  <p className={valueCls}>{caseRecord.referredTo}</p>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Description */}
      <Card padding="lg">
        <h3 className="mb-2 text-[13px] font-bold text-[#18231E] dark:text-surface-text">Description</h3>
        <p className="text-[13px] text-[#3A4741] dark:text-surface-text">{caseRecord.description}</p>
      </Card>
    </div>
  );
}
