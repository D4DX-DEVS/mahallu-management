import { useState, useEffect } from 'react';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
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
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { useFormValidation } from '@/hooks/useFormValidation';
import { FieldRule, LIMITS } from '@/utils/validation';
import { toTitleCase } from '@/utils/format';

/**
 * The same limits the API applies, so a form that passes here is not
 * refused there. Required matches what each input already declares.
 */
const RULES: Record<string, FieldRule> = {
  status: { label: 'status', maxLength: LIMITS.shortText.max },
  outcome: { label: 'outcome', maxLength: LIMITS.notes.max },
  notes: { label: 'notes', maxLength: LIMITS.notes.max },
};

export default function AcademicSupportDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [supportCase, setSupportCase] = useState<AcademicSupportCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [formData, setFormData] = useState({
    status: 'open',
    outcome: '',
    notes: '',
  });
  const { errors, validate } = useFormValidation(RULES);

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
        console.error("Couldn't load:", error);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Save had no in-flight guard: a second click while the first request was
  // still open fired the same update again.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Every field checked at once, each message on its own field.
    if (!validate(formData)) return;
    if (!supportCase || saving) return;
    setSaving(true);
    try {
      await scholarshipService.updateSupportCase(supportCase.id, formData);
      setSupportCase((prev) =>
        prev
          ? {
              ...prev,
              status: formData.status as any,
              outcome: formData.outcome,
              notes: formData.notes,
            }
          : null
      );
      setEditing(false);
      toast.success('Case updated');
    } catch (error: any) {
      toast.error(errorMessage(error, { action: 'update case' }));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!supportCase) return;
    try {
      setDeleting(true);
      await scholarshipService.deleteSupportCase(supportCase.id);
      setShowDeleteConfirm(false);
      toast.success('Support ticket deleted');
      navigate('/education/support');
    } catch (error: any) {
      toast.error(errorMessage(error, { action: 'delete support case' }));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <PageSkeleton variant="section" />;
  }

  if (!supportCase) {
    return <div className="text-center py-8 text-red-600">Case not found</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between gap-4 items-center">
        <PageHeader title="Academic Support Case" />
        <div className="flex gap-2 items-center">
          {!editing && (
            <>
              <Button onClick={() => setEditing(true)} icon={<FiEdit2 />} collapseLabel>Edit</Button>
              <Button variant="danger" onClick={() => setShowDeleteConfirm(true)} disabled={deleting} icon={<FiTrash2 />} collapseLabel>Delete</Button>
            </>
          )}
        </div>
      </div>

      <Card>
        {editing ? (
          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select
                  aria-label="Status"
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
                aria-label="Outcome"
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
                aria-label="Notes"
                name="notes"
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              />
            </div>

            <div className="flex flex-wrap gap-4">
              <Button type="submit" isLoading={saving} disabled={saving}>
                Save Changes
              </Button>
              <Button type="button" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Student</h3>
                <p className="text-lg font-semibold mt-1">{toTitleCase(memberName(supportCase.memberId))}</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground">Type</h3>
                <p className="text-lg font-semibold mt-1">{supportCaseTypeLabel(supportCase.type)}</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground">Status</h3>
                <p className="text-lg font-semibold mt-1">{supportCaseStatusLabel(supportCase.status)}</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground">Start Date</h3>
                <p className="text-lg font-semibold mt-1">
                  {new Date(supportCase.startDate).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Description</h3>
                <p className="mt-1">{supportCase.description}</p>
              </div>

              {supportCase.mentorName && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Mentor</h3>
                  <p className="mt-1">{toTitleCase(supportCase.mentorName)}</p>
                </div>
              )}

              {supportCase.outcome && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Outcome</h3>
                  <p className="mt-1">{supportCase.outcome}</p>
                </div>
              )}

              {supportCase.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Notes</h3>
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
        message={supportCase ? `Delete the support case for ${toTitleCase(memberName(supportCase.memberId))}?` : ''}
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
