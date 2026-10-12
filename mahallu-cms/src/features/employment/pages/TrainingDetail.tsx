import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { employmentService, type SkillTraining, type TrainingParticipant, EMPLOYMENT_OUTCOME_OPTIONS } from '@/services/employmentService';
import { memberService } from '@/services/memberService';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import RowActions from '@/components/ui/RowActions';
import Avatar, { PersonCell } from '@/components/ui/Avatar';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import { TableColumn } from '@/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const detailLabel = 'text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted';
const detailValue = 'mt-1 text-[13px] font-semibold text-[#18231E] dark:text-surface-text';

export default function TrainingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [training, setTraining] = useState<SkillTraining | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [formData, setFormData] = useState<Partial<SkillTraining>>({});
  const [members, setMembers] = useState<any[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(null);
  const [editingOutcome, setEditingOutcome] = useState('none');
  const [deleteParticipantId, setDeleteParticipantId] = useState<string | null>(null);
  const [showDeleteParticipantConfirm, setShowDeleteParticipantConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (id) {
          const data = await employmentService.getTraining(id);
          setTraining(data);
          setFormData(data);
        }

        // Fetch members for dropdown
        const memberRes = await memberService.getAll({ limit: 1000 });
        setMembers(memberRes.data || []);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    try {
      const updated = await employmentService.updateTraining(id, {
        name: formData.name,
        trainerName: formData.trainerName,
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: formData.status,
      });

      setTraining(updated);
      setIsEditing(false);
      toast.success('Training updated');
    } catch (error) {
      toast.error(getFriendlyError(error, "Couldn't update training. Try again in a moment."));
      console.error('Failed to update training:', error);
    }
  };

  const handleAddParticipant = async () => {
    if (!id || !selectedMemberId) return;

    try {
      const updated = await employmentService.addParticipant(id, selectedMemberId);
      setTraining(updated);
      setSelectedMemberId('');
      setShowAddParticipant(false);
      toast.success('Participant added');
    } catch (error) {
      toast.error(getFriendlyError(error, "Couldn't add participant. Try again in a moment."));
      console.error('Failed to add participant:', error);
    }
  };

  const handleUpdateParticipant = async (memberId: string) => {
    if (!id) return;

    try {
      const updated = await employmentService.updateParticipant(id, memberId, {
        employmentOutcome: editingOutcome,
      });

      setTraining(updated);
      setEditingParticipantId(null);
      toast.success('Outcome recorded');
    } catch (error) {
      toast.error(getFriendlyError(error, "Couldn't update participant. Try again in a moment."));
      console.error('Failed to update participant:', error);
    }
  };

  const handleRemoveParticipantClick = (memberId: string) => {
    setDeleteParticipantId(memberId);
    setShowDeleteParticipantConfirm(true);
  };

  const handleConfirmRemoveParticipant = async () => {
    if (!id || !deleteParticipantId) return;

    try {
      setDeleting(true);
      const updated = await employmentService.removeParticipant(id, deleteParticipantId);
      setTraining(updated);
      toast.success('Participant removed');
      setShowDeleteParticipantConfirm(false);
      setDeleteParticipantId(null);
    } catch (error) {
      toast.error(getFriendlyError(error, "Couldn't remove participant. Try again in a moment."));
      console.error('Failed to remove participant:', error);
    } finally {
      setDeleting(false);
    }
  };

  const getMemberName = (participant: TrainingParticipant): string => {
    if (participant.memberId && typeof participant.memberId === 'object') {
      return participant.memberId.name;
    }
    return '-';
  };

  const getMemberId = (participant: TrainingParticipant): string => {
    if (participant.memberId && typeof participant.memberId === 'object') {
      return participant.memberId.id;
    }
    return typeof participant.memberId === 'string' ? participant.memberId : '';
  };

  const participantColumns: TableColumn<TrainingParticipant>[] = [
    {
      key: 'member',
      label: 'Member',
      render: (_, participant) => (
        <PersonCell name={getMemberName(participant) === '-' ? undefined : getMemberName(participant)} />
      ),
    },
    {
      key: 'employmentOutcome',
      label: 'Employment Outcome',
      render: (_, participant) =>
        editingParticipantId === getMemberId(participant) ? (
          <select
            value={editingOutcome}
            onChange={(e) => setEditingOutcome(e.target.value)}
            className={`${controlClasses} h-8 w-auto py-0 text-xs`}
          >
            {EMPLOYMENT_OUTCOME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <span className="capitalize">
            {EMPLOYMENT_OUTCOME_OPTIONS.find((opt) => opt.value === participant.employmentOutcome)?.label || 'None'}
          </span>
        ),
    },
    {
      key: 'certificateIssued',
      label: 'Certificate',
      render: (_, participant) => (
        <input
          type="checkbox"
          aria-label="Certificate issued"
          checked={participant.certificateIssued || false}
          onChange={() => {
            if (id) {
              employmentService.updateParticipant(id, getMemberId(participant), {
                certificateIssued: !participant.certificateIssued,
              });
            }
          }}
          className="h-4 w-4 accent-primary-600"
        />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, participant) =>
        editingParticipantId === getMemberId(participant) ? (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="soft" onClick={() => handleUpdateParticipant(getMemberId(participant))}>
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingParticipantId(null)}>
              Cancel
            </Button>
          </div>
        ) : (
          <RowActions
            onEdit={() => {
              setEditingParticipantId(getMemberId(participant));
              setEditingOutcome(participant.employmentOutcome || 'none');
            }}
            editLabel="Edit outcome"
            onDelete={() => handleRemoveParticipantClick(getMemberId(participant))}
            deleteLabel="Remove"
            ariaLabels={{ edit: 'Edit participant outcome', delete: 'Remove participant' }}
          />
        ),
    },
  ];

  if (loading) {
    return (
      <Card className="flex justify-center py-12">
        <LoadingSpinner />
      </Card>
    );
  }

  if (!training) {
    return (
      <Card>
        <EmptyState title="Training not found" description="This training may have been removed." />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={training.name}
        leading={<Avatar name={training.name} size={56} />}
        description="Skill training details and participants"
        actions={
          !isEditing && (
            <>
              <Button variant="secondary" onClick={() => navigate('/employment/trainings')}>
                Back
              </Button>
              <Button onClick={() => setIsEditing(true)}>Edit</Button>
            </>
          )
        }
      />

      <Card padding="none">
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-5 p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Input label="Training Name" type="text" name="name" value={formData.name || ''} onChange={handleChange} />
              </div>

              <div>
                <Input label="Trainer Name" type="text" name="trainerName" value={formData.trainerName || ''} onChange={handleChange} />
              </div>

              <div>
                <Input label="Start Date" type="date" name="startDate" value={formData.startDate ? new Date(formData.startDate).toISOString().split('T')[0] : ''} onChange={handleChange} />
              </div>

              <div>
                <Input label="End Date" type="date" name="endDate" value={formData.endDate ? new Date(formData.endDate).toISOString().split('T')[0] : ''} onChange={handleChange} />
              </div>

              <div>
                <label className={labelClasses}>Status</label>
                <select
                  name="status"
                  value={formData.status || 'planned'}
                  onChange={handleChange}
                  className={`${controlClasses} h-9`}
                >
                  <option value="planned">Planned</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="secondary" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Save Changes
              </Button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-4 p-5 md:grid-cols-4">
            <div>
              <div className={detailLabel}>Trainer</div>
              <div className={detailValue}>{training.trainerName ? <PersonCell name={training.trainerName} size={24} /> : '—'}</div>
            </div>
            <div>
              <div className={detailLabel}>Start Date</div>
              <div className={detailValue}>{new Date(training.startDate).toLocaleDateString()}</div>
            </div>
            <div>
              <div className={detailLabel}>End Date</div>
              <div className={detailValue}>{new Date(training.endDate).toLocaleDateString()}</div>
            </div>
            <div>
              <div className={detailLabel}>Status</div>
              <div className="mt-1">
                <StatusBadge status={training.status} />
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Participants Section */}
      <Card padding="none">
        <div className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Participants ({training.participants?.length || 0})</h3>
            <Button onClick={() => setShowAddParticipant(!showAddParticipant)} size="sm">
              + Add Member
            </Button>
          </div>

          {showAddParticipant && (
            <div className="space-y-3 rounded-xl bg-[#F4F7F5] p-4 dark:bg-surface-raised">
              <div>
                <label className={labelClasses}>Select Member</label>
                <select
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className={`${controlClasses} h-9`}
                >
                  <option value="">Choose a member...</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.name} ({member.familyName})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleAddParticipant} disabled={!selectedMemberId}>
                  Add
                </Button>
                <Button variant="secondary" onClick={() => setShowAddParticipant(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {training.participants && training.participants.length > 0 ? (
            <Table columns={participantColumns} data={training.participants} showExport={false} />
          ) : (
            <EmptyState title="No participants yet" description="Add members to start tracking their progress." />
          )}
        </div>
      </Card>

      <ConfirmDialog
        isOpen={showDeleteParticipantConfirm}
        title="Remove participant?"
        message="This participant will be removed from the training. This cannot be undone."
        consequence="The participant's enrollment and employment outcome records will be cleared."
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleConfirmRemoveParticipant}
        onCancel={() => {
          setShowDeleteParticipantConfirm(false);
          setDeleteParticipantId(null);
        }}
      />
    </div>
  );
}
