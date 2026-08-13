import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiEdit2, FiSave } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { toast } from '@/store/toastStore';
import {
  getInheritanceCaseById,
  updateInheritanceCase,
  IInheritanceCase,
} from '@/services/counsellingService';

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
      toast.error((error as any).response?.data?.message || 'Failed to update inheritance case');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (!caseRecord) return <div className="p-4">Case not found</div>;

  return (
    <div className="flex-1 overflow-auto">
      <div className="p-4 sm:p-6">
        <Button
          variant="ghost"
          className="mb-6 flex items-center gap-2"
          onClick={() => navigate('/inheritance')}
        >
          <FiArrowLeft size={18} />
          Back
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Deceased Info */}
          <Card className="p-4">
            <h2 className="text-lg font-bold mb-4">Deceased Information</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-600">Case Number</p>
                <p className="font-medium">{caseRecord.caseNo}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Deceased Name</p>
                <p className="font-medium">{caseRecord.deceasedName || 'Member Record'}</p>
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
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Status & Scholar</h2>
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
                    type="text"
                    value={referredScholar}
                    onChange={(e) => setReferredScholar(e.target.value)}
                    placeholder="Scholar name or reference"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div className="flex gap-2 pt-3">
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
                    <p className="font-medium">{caseRecord.referredScholar}</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Heirs Table */}
        <Card className="p-4 mb-6">
          <h2 className="text-lg font-bold mb-4">Heirs</h2>
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
                      <td className="py-2 px-3">{heir.name}</td>
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
          <Card className="p-4">
            <label className="block text-sm font-medium mb-2">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </Card>
        ) : (
          caseRecord.notes && (
            <Card className="p-4 bg-amber-50 border border-amber-200">
              <h3 className="font-bold mb-2">Notes</h3>
              <p className="text-sm text-gray-700">{caseRecord.notes}</p>
            </Card>
          )
        )}
      </div>
    </div>
  );
}
