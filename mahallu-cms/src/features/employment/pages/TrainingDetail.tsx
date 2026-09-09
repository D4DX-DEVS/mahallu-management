import { useEffect, useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import { useParams, useNavigate } from 'react-router-dom';
import {
  employmentService,
  type SkillTraining,
  type TrainingParticipant,
  EMPLOYMENT_OUTCOME_OPTIONS,
} from '@/services/employmentService';
import { memberService } from '@/services/memberService';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import PageHeader from '@/components/layout/PageHeader';
import Input from '@/components/ui/Input';
import { FieldRule, validateForm, firstError, LIMITS } from '@/utils/validation';

/** The same rules as the create form and the API. */
const RULES: Record<string, FieldRule> = {
  name: { label: 'training name', required: true, minLength: LIMITS.name.min, maxLength: LIMITS.title.max },
  trainerName: { label: 'trainer’s name', maxLength: LIMITS.name.max },
  startDate: { label: 'start date', type: 'date' },
  endDate: { label: 'end date', type: 'date', notBefore: 'startDate', notBeforeLabel: 'start date' },
};

export default function TrainingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [training, setTraining] = useState<SkillTraining | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
        console.error("Couldn't load data:", error);
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

  // Save had no in-flight guard: a second click while the first request was
  // still open fired the same update again.
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || saving) return;

    // Inline edit had no checks at all - an end date before the start date
    // among them.
    const problems = validateForm(formData, RULES);
    if (Object.keys(problems).length > 0) {
      toast.error(firstError(problems));
      return;
    }
    setSaving(true);

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
      const message =
        error instanceof Error && 'response' in error
          ? (error.response as any)?.data?.message || "Couldn't update training"
          : "Couldn't update training";
      toast.error(message);
      console.error("Couldn't update training:", error);
    } finally {
      setSaving(false);
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
      const message =
        error instanceof Error && 'response' in error
          ? (error.response as any)?.data?.message || "Couldn't add participant"
          : "Couldn't add participant";
      toast.error(message);
      console.error("Couldn't add participant:", error);
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
      const message =
        error instanceof Error && 'response' in error
          ? (error.response as any)?.data?.message || "Couldn't update participant"
          : "Couldn't update participant";
      toast.error(message);
      console.error("Couldn't update participant:", error);
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
      toast.error("Couldn't remove participant. Please try again.");
      console.error("Couldn't remove participant:", error);
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

  if (loading) {
    return <Card className="p-5 text-center">Loading training details...</Card>;
  }

  if (!training) {
    return (
      <Card className="p-5 text-center text-gray-500">
        <p>Training not found</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/employment/trainings')}
            className="p-2 hover:bg-gray-100 rounded text-lg"
          >
            ←
          </button>
          <PageHeader title={training.name} />
        </div>
        {!isEditing && (
          <Button onClick={() => setIsEditing(true)} className="bg-blue-600 text-white">
            Edit
          </Button>
        )}
      </div>

      <Card>
        {isEditing ? (
          <form onSubmit={handleSave} className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Training Name</label>
                <input
                  aria-label="Training Name"
                  type="text"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Trainer Name</label>
                <input
                  aria-label="Trainer Name"
                  type="text"
                  name="trainerName"
                  value={formData.trainerName || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <Input
                label="Start date"
                type="date"
                name="startDate"
                value={formData.startDate ? new Date(formData.startDate).toISOString().split('T')[0] : ''}
                onChange={handleChange}
              />

              <Input
                label="End date"
                type="date"
                name="endDate"
                value={formData.endDate ? new Date(formData.endDate).toISOString().split('T')[0] : ''}
                onChange={handleChange}
              />

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Status</label>
                <select
                  aria-label="Status"
                  name="status"
                  value={formData.status || 'planned'}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="planned">Planned</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-3">
              <Button onClick={() => setIsEditing(false)} className="bg-gray-200 text-gray-800">
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 text-white" isLoading={saving} disabled={saving}>
                Save Changes
              </Button>
            </div>
          </form>
        ) : (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <div className="text-xs text-gray-600">Trainer</div>
                <div className="font-semibold text-gray-900 capitalize">{training.trainerName || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Start Date</div>
                <div className="font-semibold text-gray-900">
                  {new Date(training.startDate).toLocaleDateString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600">End Date</div>
                <div className="font-semibold text-gray-900">
                  {new Date(training.endDate).toLocaleDateString()}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-600">Status</div>
                <div className="font-semibold text-gray-900 capitalize">{training.status}</div>
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* Participants Section */}
      <Card>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">
              Participants ({training.participants?.length || 0})
            </h3>
            <Button
              onClick={() => setShowAddParticipant(!showAddParticipant)}
              size="sm"
              className="bg-blue-600 text-white" icon={<FiPlus />} collapseLabel>Add Member</Button>
          </div>

          {showAddParticipant && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Select Member</label>
                <select
                  aria-label="Select Member"
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose a member...</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id} className="capitalize">
                      {member.name} ({member.familyName})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleAddParticipant}
                  className="bg-blue-600 text-white"
                  disabled={!selectedMemberId}
                >
                  Add
                </Button>
                <Button onClick={() => setShowAddParticipant(false)} className="bg-gray-200 text-gray-800">
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {training.participants && training.participants.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="px-4 py-3 text-left text-label font-semibold text-gray-700">Member</th>
                    <th className="px-4 py-3 text-left text-label font-semibold text-gray-700">
                      Employment Outcome
                    </th>
                    <th className="px-4 py-3 text-center text-label font-semibold text-gray-700">Certificate</th>
                    <th className="px-4 py-3 text-right text-label font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {training.participants.map((participant) => (
                    <tr key={getMemberId(participant)} className="border-b hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 capitalize">
                        {getMemberName(participant)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {editingParticipantId === getMemberId(participant) ? (
                          <select
                            aria-label="Filter"
                            value={editingOutcome}
                            onChange={(e) => setEditingOutcome(e.target.value)}
                            className="px-2 py-1 border rounded text-sm"
                          >
                            {EMPLOYMENT_OUTCOME_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="capitalize">
                            {EMPLOYMENT_OUTCOME_OPTIONS.find(
                              (opt) => opt.value === participant.employmentOutcome
                            )?.label || 'None'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          aria-label="Select row"
                          type="checkbox"
                          checked={participant.certificateIssued || false}
                          onChange={() => {
                            if (id) {
                              employmentService.updateParticipant(id, getMemberId(participant), {
                                certificateIssued: !participant.certificateIssued,
                              });
                            }
                          }}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="px-4 py-3 text-right space-x-2">
                        {editingParticipantId === getMemberId(participant) ? (
                          <>
                            <button
                              onClick={() => handleUpdateParticipant(getMemberId(participant))}
                              className="text-green-600 hover:text-green-900 px-2 py-1 text-sm rounded hover:bg-green-50"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingParticipantId(null)}
                              className="text-gray-600 hover:text-gray-900 px-2 py-1 text-sm rounded hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEditingParticipantId(getMemberId(participant));
                                setEditingOutcome(participant.employmentOutcome || 'none');
                              }}
                              className="text-blue-600 hover:text-blue-900 px-2 py-1 text-sm rounded hover:bg-blue-50"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleRemoveParticipantClick(getMemberId(participant))}
                              className="text-red-600 hover:text-red-900 px-2 py-1 text-xs hover:bg-red-50 rounded"
                              title="Remove"
                              aria-label="Remove"
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No participants yet. Add members to start tracking their progress.</p>
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog
        isOpen={showDeleteParticipantConfirm}
        title="Remove Participant"
        message="Are you sure you want to remove this participant from the training?"
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
