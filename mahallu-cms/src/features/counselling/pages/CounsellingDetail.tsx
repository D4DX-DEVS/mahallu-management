import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiEdit2, FiSave, FiTrash2 } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Modal from '@/components/ui/Modal';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import {
  getCounsellingCaseById,
  addCounsellingNote,
  updateCounsellingCase,
  deleteCounsellingCase,
  ICounsellingCase,
} from '@/services/counsellingService';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

export default function CounsellingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [caseRecord, setCaseRecord] = useState<ICounsellingCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editStatus, setEditStatus] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      console.error("Couldn't load case:", error);
      toast.error(loadErrorMessage(error, 'the counselling case'));
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
      console.error("Couldn't add note:", error);
      toast.error(errorMessage(error, { action: 'add session note' }));
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
      console.error("Couldn't update status:", error);
      toast.error(errorMessage(error, { action: 'update case status' }));
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      setDeleting(true);
      await deleteCounsellingCase(id);
      toast.success('Counselling case deleted');
      navigate('/counselling');
    } catch (error) {
      toast.error(errorMessage(error, { action: 'delete counselling case' }));
      setDeleting(false);
    }
  };

  if (loading) return <PageSkeleton />;
  if (!caseRecord) return <div className="p-4">Case not found</div>;

  return (
    <div>
      <div className="flex gap-2 items-center justify-between">
        <div className="flex items-center gap-4">
          <PageHeader title="Counselling case" breadcrumbs={[{ label: 'Counselling', path: '/counselling' }]} />
          <div className="flex gap-2 items-center">
            <Button variant="danger" onClick={() => setShowDeleteModal(true)} icon={<FiTrash2 />} collapseLabel>
              Delete
            </Button>
          </div>
        </div>
      </div>
      <div>
        <Button
          variant="ghost"
          className="mb-4 flex items-center gap-2"
          onClick={() => navigate('/counselling')}
        >
          <FiArrowLeft size={18} />
          Back
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Case Info */}
          <Card>
            <h2 className="text-lg font-semibold mb-3">Case Information</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-600">Case Number</p>
                <p className="font-medium">{caseRecord.caseNo}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Category</p>
                <p className="font-medium capitalize">{caseRecord.category}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Counsellor</p>
                <p className="font-medium">{toTitleCase(caseRecord.counsellorName)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Client</p>
                <p className="font-medium">
                  {caseRecord.clientName
                    ? toTitleCase(caseRecord.clientName)
                    : caseRecord.clientMemberId
                      ? 'Member ID'
                      : 'Anonymous'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Appointment Date</p>
                <p className="font-medium">{new Date(caseRecord.appointmentDate).toLocaleDateString()}</p>
              </div>
            </div>
          </Card>

          {/* Status */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Status</h2>
              {!isEditing && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2"
                >
                  <FiEdit2 size={16} />
                </Button>
              )}
            </div>
            {isEditing ? (
              <div className="space-y-3">
                <select
                  aria-label="Filter"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="follow_up">Follow Up</option>
                  <option value="closed">Closed</option>
                </select>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" size="sm" onClick={handleSaveStatus}>
                    <FiSave size={16} />
                    Save
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="font-medium capitalize">{caseRecord.status.replace(/_/g, ' ')}</p>
            )}
          </Card>
        </div>

        {/* Session Notes Timeline */}
        <Card className="mb-4">
          <h2 className="text-lg font-semibold mb-3">Session Notes</h2>
          <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
            {caseRecord.sessionNotes && caseRecord.sessionNotes.length > 0 ? (
              caseRecord.sessionNotes.map((sessionNote, idx) => (
                <div key={idx} className="border-l-2 border-gray-300 pl-4">
                  <p className="text-xs text-gray-600">
                    {new Date(sessionNote.date).toLocaleString()} by {toTitleCase(sessionNote.addedBy)}
                  </p>
                  <p className="text-sm mt-1">{sessionNote.note}</p>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No session notes yet. Add one below to get started.</p>
            )}
          </div>

          {/* Add Note Form */}
          <div className="border-t pt-4">
            <label className="block text-sm font-medium mb-2">Add Session Note</label>
            <textarea
              aria-label="Add Session Note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Enter session note..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <Button
              variant="primary"
              size="sm"
              onClick={handleAddNote}
              disabled={addingNote || !note.trim()}
              className="mt-3"
            >
              {addingNote ? 'Adding...' : 'Add Note'}
            </Button>
          </div>
        </Card>

        {/* Closure Notes */}
        {caseRecord.closureNotes && (
          <Card className="bg-amber-50 border border-amber-200">
            <h3 className="font-semibold mb-2">Closure Notes</h3>
            <p className="text-sm">{caseRecord.closureNotes}</p>
          </Card>
        )}
      </div>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Counselling Case"
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
          Are you sure you want to delete <strong>{caseRecord.caseNo}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
