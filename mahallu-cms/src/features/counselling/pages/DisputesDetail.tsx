import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiEdit2, FiSave } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { toast } from '@/store/toastStore';
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
      toast.error((error as any).response?.data?.message || 'Failed to update dispute case');
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
          onClick={() => navigate('/maslahat')}
        >
          <FiArrowLeft size={18} />
          Back
        </Button>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Case Info */}
          <Card className="p-4">
            <h2 className="text-lg font-bold mb-4">Case Information</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-600">Case Number</p>
                <p className="font-medium">{caseRecord.caseNo}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Type</p>
                <p className="font-medium capitalize">{caseRecord.type}</p>
              </div>
              <div>
                <p className="text-xs text-gray-600">Parties Involved</p>
                <p className="font-medium">{caseRecord.parties.join(', ')}</p>
              </div>
              {caseRecord.mediators && caseRecord.mediators.length > 0 && (
                <div>
                  <p className="text-xs text-gray-600">Mediators</p>
                  <p className="font-medium">{caseRecord.mediators.join(', ')}</p>
                </div>
              )}
            </div>
          </Card>

          {/* Status & Notes */}
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">Status & Resolution</h2>
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
                  <label className="block text-sm font-medium mb-2">Resolution Notes</label>
                  <textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Referred To (if applicable)</label>
                  <input
                    type="text"
                    value={referredTo}
                    onChange={(e) => setReferredTo(e.target.value)}
                    placeholder="Scholar/authority name"
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
                {caseRecord.resolutionNotes && (
                  <div>
                    <p className="text-xs text-gray-600">Resolution Notes</p>
                    <p className="text-sm">{caseRecord.resolutionNotes}</p>
                  </div>
                )}
                {caseRecord.referredTo && (
                  <div>
                    <p className="text-xs text-gray-600">Referred To</p>
                    <p className="font-medium">{caseRecord.referredTo}</p>
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Description */}
        <Card className="p-4">
          <h3 className="font-bold mb-2">Description</h3>
          <p className="text-sm text-gray-700">{caseRecord.description}</p>
        </Card>
      </div>
    </div>
  );
}
