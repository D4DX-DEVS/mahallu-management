import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiEdit2, FiSave } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import { PersonCell } from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Alert from '@/components/ui/Alert';
import Select from '@/components/ui/Select';
import { controlClasses, labelClasses } from '@/components/ui/Input';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import {
  getCounsellingCaseById,
  addCounsellingNote,
  updateCounsellingCase,
  ICounsellingCase,
} from '@/services/counsellingService';

export default function CounsellingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [caseRecord, setCaseRecord] = useState<ICounsellingCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editStatus, setEditStatus] = useState('');

  useEffect(() => {
    if (id) fetchCase(id);
  }, [id]);

  const fetchCase = async (caseId: string) => {
    try {
      setLoading(true);
      const response = await getCounsellingCaseById(caseId);
      setCaseRecord(response.data);
      setEditStatus(response.data.status);
    } catch (error) {
      console.error('Failed to fetch case:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNote = async () => {
    if (!note.trim() || !id) return;
    try {
      setAddingNote(true);
      const response = await addCounsellingNote(id, note);
      setCaseRecord(response.data);
      setNote('');
      toast.success('Session note added');
    } catch (error) {
      console.error('Failed to add note:', error);
      toast.error(getFriendlyError(error, "Couldn't add session note. Try again in a moment."));
    } finally {
      setAddingNote(false);
    }
  };

  const handleSaveStatus = async () => {
    if (!id) return;
    try {
      const response = await updateCounsellingCase(id, { status: editStatus as any });
      setCaseRecord(response.data);
      setIsEditing(false);
      toast.success('Case status updated');
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error(getFriendlyError(error, "Couldn't update case status. Try again in a moment."));
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!caseRecord) return <Alert tone="danger">Case not found</Alert>;

  const labelCls = 'text-[12px] font-bold uppercase tracking-[0.04em] text-[#7B8983] dark:text-surface-muted';
  const valueCls = 'mt-0.5 text-[13px] font-semibold text-[#18231E] dark:text-surface-text';
  const statusLabel = caseRecord.status.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

  return (
    <div className="space-y-4">
      <PageHeader
        title={caseRecord.caseNo}
        description="Counselling case"
        actions={
          <Button variant="secondary" onClick={() => navigate('/counselling')}>
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
              <p className={labelCls}>Category</p>
              <p className="mt-1">
                <Badge variant="info" className="capitalize">{caseRecord.category}</Badge>
              </p>
            </div>
            <div>
              <p className={labelCls}>Counsellor</p>
              <div className={valueCls}><PersonCell name={caseRecord.counsellorName} size={32} /></div>
            </div>
            <div>
              <p className={labelCls}>Client</p>
              <div className={valueCls}>
                {caseRecord.clientName ? (
                  <PersonCell name={caseRecord.clientName} size={32} />
                ) : caseRecord.clientMemberId ? (
                  'Member ID'
                ) : (
                  'Anonymous'
                )}
              </div>
            </div>
            <div>
              <p className={labelCls}>Appointment Date</p>
              <p className={valueCls}>{new Date(caseRecord.appointmentDate).toLocaleDateString()}</p>
            </div>
          </div>
        </Card>

        {/* Status */}
        <Card padding="lg">
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Status</h2>
            {!isEditing && (
              <Button variant="secondary" iconOnly size="sm" aria-label="Edit status" onClick={() => setIsEditing(true)}>
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
                options={[
                  { value: 'open', label: 'Open' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'follow_up', label: 'Follow Up' },
                  { value: 'closed', label: 'Closed' },
                ]}
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSaveStatus}>
                  <FiSave size={14} />
                  Save
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <StatusBadge status={caseRecord.status} label={statusLabel} />
          )}
        </Card>
      </div>

      {/* Session Notes Timeline */}
      <Card padding="lg">
        <h2 className="mb-3.5 text-[13px] font-bold text-[#18231E] dark:text-surface-text">Session Notes</h2>
        <div className="mb-5 max-h-96 space-y-4 overflow-y-auto">
          {caseRecord.sessionNotes && caseRecord.sessionNotes.length > 0 ? (
            caseRecord.sessionNotes.map((sessionNote, idx) => (
              <div key={idx} className="border-l-2 border-mint-deep pl-4 dark:border-surface-border-strong">
                <p className="text-xs text-[#7B8983] dark:text-surface-muted">
                  {new Date(sessionNote.date).toLocaleString()} by {sessionNote.addedBy}
                </p>
                <p className="mt-1 text-[13px] text-[#18231E] dark:text-surface-text">{sessionNote.note}</p>
              </div>
            ))
          ) : (
            <p className="text-[13px] text-[#7B8983] dark:text-surface-muted">No session notes yet. Add one below to get started.</p>
          )}
        </div>

        {/* Add Note Form */}
        <div className="border-t border-line-soft pt-4 dark:border-surface-border">
          <label htmlFor="session-note" className={labelClasses}>Add Session Note</label>
          <textarea
            id="session-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Enter session note..."
            rows={3}
            className={`${controlClasses} py-2`}
          />
          <Button size="sm" onClick={handleAddNote} disabled={addingNote || !note.trim()} className="mt-3">
            {addingNote ? 'Adding...' : 'Add Note'}
          </Button>
        </div>
      </Card>

      {/* Closure Notes */}
      {caseRecord.closureNotes && (
        <Alert tone="warning" title="Closure Notes">
          {caseRecord.closureNotes}
        </Alert>
      )}
    </div>
  );
}
