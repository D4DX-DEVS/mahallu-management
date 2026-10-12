import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import Avatar, { PersonCell } from '@/components/ui/Avatar';
import Alert from '@/components/ui/Alert';
import Select from '@/components/ui/Select';
import { controlClasses, labelClasses } from '@/components/ui/Input';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
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
      toast.error(getFriendlyError(error, "Couldn't update case. Try again in a moment."));
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
      toast.error(getFriendlyError(error, "Couldn't delete support case. Try again in a moment."));
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!supportCase) {
    return <Alert tone="danger">Case not found</Alert>;
  }

  const labelCls = 'text-[12px] font-bold uppercase tracking-[0.04em] text-[#7B8983] dark:text-surface-muted';
  const valueCls = 'mt-0.5 text-[13px] font-semibold text-[#18231E] dark:text-surface-text';

  return (
    <div className="space-y-4">
      <PageHeader
        title="Academic support case"
        leading={<Avatar size={56} name={memberName(supportCase.memberId)} />}
        description={`${memberName(supportCase.memberId)} · ${supportCaseTypeLabel(supportCase.type)}`}
        actions={
          !editing && (
            <>
              <Button variant="secondary" onClick={() => setEditing(true)}>Edit</Button>
              <Button variant="danger" onClick={() => setShowDeleteConfirm(true)} disabled={deleting}>
                Delete
              </Button>
            </>
          )
        }
      />

      {editing ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Card padding="lg">
            <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Update case</h2>
            <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Change the status, outcome and notes</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select
                label="Status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                options={SUPPORT_CASE_STATUS_OPTIONS}
              />
              <div className="md:col-span-2">
                <label htmlFor="case-outcome" className={labelClasses}>Outcome</label>
                <textarea
                  id="case-outcome"
                  name="outcome"
                  placeholder="Outcome of support..."
                  value={formData.outcome}
                  onChange={handleChange}
                  rows={3}
                  className={`${controlClasses} py-2`}
                />
              </div>
              <div className="md:col-span-2">
                <label htmlFor="case-notes" className={labelClasses}>Notes</label>
                <textarea
                  id="case-notes"
                  name="notes"
                  placeholder="Additional notes..."
                  value={formData.notes}
                  onChange={handleChange}
                  rows={3}
                  className={`${controlClasses} py-2`}
                />
              </div>
            </div>
          </Card>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button type="submit">Save Changes</Button>
          </div>
        </form>
      ) : (
        <>
          <Card padding="lg">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <div>
                <h3 className={labelCls}>Student</h3>
                <div className="mt-1"><PersonCell name={memberName(supportCase.memberId)} size={32} /></div>
              </div>
              <div>
                <h3 className={labelCls}>Type</h3>
                <p className={valueCls}>{supportCaseTypeLabel(supportCase.type)}</p>
              </div>
              <div>
                <h3 className={labelCls}>Status</h3>
                <p className="mt-1">
                  <StatusBadge status={supportCase.status} label={supportCaseStatusLabel(supportCase.status)} />
                </p>
              </div>
              <div>
                <h3 className={labelCls}>Start Date</h3>
                <p className={valueCls}>{new Date(supportCase.startDate).toLocaleDateString()}</p>
              </div>
            </div>
          </Card>

          <Card padding="lg">
            <h2 className="mb-3 text-[13px] font-bold text-[#18231E] dark:text-surface-text">Case notes</h2>
            <div className="space-y-4">
              <div>
                <h3 className={labelCls}>Description</h3>
                <p className="mt-0.5 text-[13px] text-[#3A4741] dark:text-surface-text">{supportCase.description}</p>
              </div>

              {supportCase.mentorName && (
                <div>
                  <h3 className={labelCls}>Mentor</h3>
                  <div className="mt-0.5"><PersonCell name={supportCase.mentorName} size={24} /></div>
                </div>
              )}

              {supportCase.outcome && (
                <div>
                  <h3 className={labelCls}>Outcome</h3>
                  <p className="mt-0.5 text-[13px] text-[#3A4741] dark:text-surface-text">{supportCase.outcome}</p>
                </div>
              )}

              {supportCase.notes && (
                <div>
                  <h3 className={labelCls}>Notes</h3>
                  <p className="mt-0.5 text-[13px] text-[#3A4741] dark:text-surface-text">{supportCase.notes}</p>
                </div>
              )}
            </div>
          </Card>
        </>
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete support case?"
        message={supportCase ? `Delete the support case for ${memberName(supportCase.memberId)}?` : ''}
        consequence="This cannot be undone."
        isLoading={deleting}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
