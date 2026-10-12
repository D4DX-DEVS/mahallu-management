import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiEdit2, FiSave } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { PersonCell } from '@/components/ui/Avatar';
import Alert from '@/components/ui/Alert';
import Select from '@/components/ui/Select';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import {
  getInheritanceCaseById,
  updateInheritanceCase,
  IInheritanceCase,
} from '@/services/counsellingService';
import ScrollX from '@/features/_shared/ScrollX';

const STATUSES = ['reported', 'documentation', 'referred', 'distributed', 'closed'];

export default function InheritanceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [caseRecord, setCaseRecord] = useState<IInheritanceCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [referredScholar, setReferredScholar] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) fetchCase(id);
  }, [id]);

  const fetchCase = async (caseId: string) => {
    try {
      setLoading(true);
      const response = await getInheritanceCaseById(caseId);
      setCaseRecord(response.data);
      setEditStatus(response.data.status);
      setReferredScholar(response.data.referredScholar || '');
      setNotes(response.data.notes || '');
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
      const response = await updateInheritanceCase(id, {
        status: editStatus as any,
        referredScholar,
        notes,
      });
      setCaseRecord(response.data);
      setIsEditing(false);
      toast.success('Inheritance case updated');
    } catch (error) {
      console.error('Failed to update case:', error);
      toast.error(getFriendlyError(error, "Couldn't update inheritance case. Try again in a moment."));
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
        description="Inheritance case"
        actions={
          <Button variant="secondary" onClick={() => navigate('/inheritance')}>
            Back
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Deceased Info */}
        <Card padding="lg">
          <h2 className="mb-3.5 text-[13px] font-bold text-[#18231E] dark:text-surface-text">Deceased Information</h2>
          <div className="space-y-3">
            <div>
              <p className={labelCls}>Case Number</p>
              <p className={valueCls}>{caseRecord.caseNo}</p>
            </div>
            <div>
              <p className={labelCls}>Deceased Name</p>
              <div className={valueCls}>{caseRecord.deceasedName ? <PersonCell name={caseRecord.deceasedName} size={32} /> : 'Member Record'}</div>
            </div>
            {caseRecord.deathRegistrationId && (
              <div>
                <p className={labelCls}>Death Registration ID</p>
                <p className={valueCls}>{caseRecord.deathRegistrationId}</p>
              </div>
            )}
          </div>
        </Card>

        {/* Status & Scholar */}
        <Card padding="lg">
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Status & Scholar</h2>
            {!isEditing && (
              <Button variant="secondary" iconOnly size="sm" aria-label="Edit status and scholar" onClick={() => setIsEditing(true)}>
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
              <Input
                label="Referred Scholar"
                type="text"
                value={referredScholar}
                onChange={(e) => setReferredScholar(e.target.value)}
                placeholder="Scholar name or reference"
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
              {caseRecord.referredScholar && (
                <div>
                  <p className={labelCls}>Referred Scholar</p>
                  <p className={valueCls}>{caseRecord.referredScholar}</p>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Heirs Table */}
      <Card padding="none">
        <div className="border-b border-line-soft px-3.5 py-3 dark:border-surface-border">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Heirs</h2>
        </div>
        {caseRecord.heirs && caseRecord.heirs.length > 0 ? (
          <ScrollX>
            <table className="w-full border-collapse text-[12.5px]">
              <thead className="bg-[#FAFCFB] dark:bg-surface-base/60">
                <tr className="border-b border-line-soft dark:border-surface-border">
                  <th className="px-3.5 py-2.5 text-left text-[12px] font-bold uppercase tracking-[0.06em] text-[#7B8983] dark:text-surface-muted">Name</th>
                  <th className="px-3.5 py-2.5 text-left text-[12px] font-bold uppercase tracking-[0.06em] text-[#7B8983] dark:text-surface-muted">Relation</th>
                  <th className="px-3.5 py-2.5 text-left text-[12px] font-bold uppercase tracking-[0.06em] text-[#7B8983] dark:text-surface-muted">Contact No</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft dark:divide-surface-border">
                {caseRecord.heirs.map((heir, idx) => (
                  <tr key={idx} className="h-11 transition-colors hover:bg-[#F6FAF8] dark:hover:bg-surface-hover/60">
                    <td className="px-3.5 py-2 font-semibold"><PersonCell name={heir.name} size={24} /></td>
                    <td className="px-3.5 py-2">{heir.relation ? <StatusBadge status={heir.relation} tone="neutral" dot={false} /> : '—'}</td>
                    <td className="px-3.5 py-2">{heir.contactNo || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </ScrollX>
        ) : (
          <p className="px-3.5 py-6 text-center text-[13px] text-[#7B8983] dark:text-surface-muted">No heirs recorded</p>
        )}
      </Card>

      {/* Notes */}
      {isEditing ? (
        <Card padding="lg">
          <label htmlFor="inheritance-notes" className={labelClasses}>Notes</label>
          <textarea
            id="inheritance-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={4}
            className={`${controlClasses} py-2`}
          />
        </Card>
      ) : (
        caseRecord.notes && (
          <Alert tone="warning" title="Notes">
            {caseRecord.notes}
          </Alert>
        )
      )}
    </div>
  );
}
