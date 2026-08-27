import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { PageSkeleton } from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import {
  scholarshipService,
  AcademicSupportCase,
  SUPPORT_CASE_STATUS_OPTIONS,
  supportCaseTypeLabel,
  supportCaseStatusLabel,
  memberName,
} from '@/services/scholarshipService';

export default function AcademicSupportDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [supportCase, setSupportCase] = useState<AcademicSupportCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState({
    status: 'open',
    outcome: '',
    notes: '',
  });

  useEffect(() => {
    if (!id) return;
    const fetch = async () => {
      try {
        const data = await scholarshipService.getSupportCase(id);
        setSupportCase(data);
        setFormData({
          status: data.status,
          outcome: data.outcome || '',
          notes: data.notes || '',
        });
      } catch (error) {
        console.error('Failed to fetch:', error);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportCase) return;
    try {
      await scholarshipService.updateSupportCase(supportCase.id, formData);
      setSupportCase((prev) =>
        prev ? {
          ...prev,
          status: formData.status as any,
          outcome: formData.outcome,
          notes: formData.notes,
        } : null
      );
      setEditing(false);
      toast.success('Case updated');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update case');
    }
  };

  const handleDelete = async () => {
    if (!supportCase) return;
    try {
      setDeleting(true);
      await scholarshipService.deleteSupportCase(supportCase.id);
      setShowDeleteConfirm(false);
      toast.success('Support case deleted');
      navigate('/education/support');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete support case');
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <PageSkeleton variant="section" />
    );
  }

  if (!supportCase) {
    return <div className="text-center py-8 text-red-600">Case not found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Academic Support Case</h1>
        <div className="flex gap-2">
          {!editing && (
            <>
              <Button onClick={() => setEditing(true)}>Edit</Button>
              <Button variant="danger" onClick={() => setShowDeleteConfirm(true)} disabled={deleting}>
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <Card>
        {editing ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                >
                  {SUPPORT_CASE_STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Outcome</label>
              <textarea
                name="outcome"
                placeholder="Outcome of support..."
                value={formData.outcome}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Notes</label>
              <textarea
                name="notes"
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              />
            </div>

            <div className="flex gap-4">
              <Button type="submit">Save Changes</Button>
              <Button
                type="button"
                onClick={() => setEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Student</h3>
                <p className="text-lg font-semibold mt-1">{memberName(supportCase.memberId)}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Type</h3>
                <p className="text-lg font-semibold mt-1">{supportCaseTypeLabel(supportCase.type)}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Status</h3>
                <p className="text-lg font-semibold mt-1">{supportCaseStatusLabel(supportCase.status)}</p>
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Start Date</h3>
                <p className="text-lg font-semibold mt-1">
                  {new Date(supportCase.startDate).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
              <div>
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Description</h3>
                <p className="mt-1">{supportCase.description}</p>
              </div>

              {supportCase.mentorName && (
                <div>
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Mentor</h3>
                  <p className="mt-1">{supportCase.mentorName}</p>
                </div>
              )}

              {supportCase.outcome && (
                <div>
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Outcome</h3>
                  <p className="mt-1">{supportCase.outcome}</p>
                </div>
              )}

              {supportCase.notes && (
                <div>
                  <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Notes</h3>
                  <p className="mt-1">{supportCase.notes}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Support Case"
        message={supportCase ? `Delete the support case for ${memberName(supportCase.memberId)}?` : ''}
        consequence="This action cannot be undone."
        isLoading={deleting}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
