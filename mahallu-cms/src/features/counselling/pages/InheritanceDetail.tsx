import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiEdit2, FiSave, FiTrash2 } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import {
  getInheritanceCaseById,
  updateInheritanceCase,
  deleteInheritanceCase,
  IInheritanceCase,
} from '@/services/counsellingService';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      console.error("Couldn't load case:", error);
      toast.error(loadErrorMessage(error, 'the inheritance case'));
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
      console.error("Couldn't update case:", error);
      toast.error(errorMessage(error, { action: 'update inheritance case' }));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      setDeleting(true);
      await deleteInheritanceCase(id);
      toast.success('Inheritance case deleted');
      navigate('/inheritance');
    } catch (error) {
      toast.error(errorMessage(error, { action: 'delete inheritance case' }));
      setDeleting(false);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (!caseRecord) return <div className="p-4">Case not found</div>;

  return (
    <div>
      <div className="flex gap-2 items-center justify-between">
        <div className="flex items-center gap-4">
          <PageHeader title="Inheritance case" breadcrumbs={[{ label: 'Inheritance', path: '/inheritance' }]} />
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
          onClick={() => navigate('/inheritance')}
        >
          <FiArrowLeft size={18} />
          Back
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Deceased Info */}
          <Card>
            <h2 className="text-lg font-semibold mb-3">Deceased Information</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-600">Case Number</p>
                <p className="font-medium">{caseRecord.caseNo}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Deceased Name</p>
                <p className="font-medium">{toTitleCase(caseRecord.deceasedName || 'Member Record')}</p>
              </div>
              {caseRecord.deathRegistrationId && (
                <div>
                  <p className="text-xs text-gray-600">Death Registration ID</p>
                  <p className="font-medium">{caseRecord.deathRegistrationId}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Status & Scholar */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Status & Scholar</h2>
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
                <div>
                  <label className="block text-sm font-medium mb-2">Status</label>
                  <select
                    aria-label="Status"
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    {STATUSES.map((sts) => (
                      <option key={sts} value={sts}>
                        {sts.charAt(0).toUpperCase() + sts.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Referred Scholar</label>
                  <input
                    aria-label="Referred Scholar"
                    type="text"
                    value={referredScholar}
                    onChange={(e) => setReferredScholar(e.target.value)}
                    placeholder="Scholar name or reference"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div className="flex flex-wrap gap-2 pt-3">
                  <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
                    <FiSave size={16} />
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
                  <p className="text-xs text-gray-600">Status</p>
                  <p className="font-medium capitalize">{caseRecord.status}</p>
                </div>
                {caseRecord.referredScholar && (
                  <div>
                    <p className="text-xs text-gray-600">Referred Scholar</p>
                    <p className="font-medium">{toTitleCase(caseRecord.referredScholar)}</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Heirs Table */}
        <Card className="mb-4">
          <h2 className="text-lg font-semibold mb-3">Heirs</h2>
          {caseRecord.heirs && caseRecord.heirs.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-semibold">Name</th>
                    <th className="text-left py-2 px-3 font-semibold">Relation</th>
                    <th className="text-left py-2 px-3 font-semibold">Contact No</th>
                  </tr>
                </thead>
                <tbody>
                  {caseRecord.heirs.map((heir, idx) => (
                    <tr key={idx} className="border-b hover:bg-gray-50">
                      <td className="py-2 px-3">{toTitleCase(heir.name)}</td>
                      <td className="py-2 px-3">{heir.relation}</td>
                      <td className="py-2 px-3">{heir.contactNo || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No heirs recorded</p>
          )}
        </Card>

        {/* Notes */}
        {isEditing ? (
          <Card>
            <label className="block text-sm font-medium mb-2">Notes</label>
            <textarea
              aria-label="Notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </Card>
        ) : (
          caseRecord.notes && (
            <Card className="bg-amber-50 border border-amber-200">
              <h3 className="font-semibold mb-2">Notes</h3>
              <p className="text-sm text-gray-700">{caseRecord.notes}</p>
            </Card>
          )
        )}
      </div>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Inheritance Case"
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
