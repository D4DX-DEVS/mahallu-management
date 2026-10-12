import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { employmentService, type Employer } from '@/services/employmentService';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import Avatar from '@/components/ui/Avatar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import { FiBriefcase, FiUser } from 'react-icons/fi';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

export default function EmployerEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employer, setEmployer] = useState<Employer | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Employer>>({});
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const fetchEmployer = async () => {
      try {
        if (id) {
          const data = await employmentService.getEmployer(id);
          setEmployer(data);
          setFormData(data);
        }
      } catch (error) {
        console.error('Failed to fetch employer:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployer();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    try {
      const updated = await employmentService.updateEmployer(id, {
        name: formData.name,
        businessType: formData.businessType,
        contactPerson: formData.contactPerson,
        contactNo: formData.contactNo,
        location: formData.location,
        notes: formData.notes,
        status: formData.status,
      });

      setEmployer(updated);
      setIsEditing(false);
      toast.success('Employer updated');
    } catch (error) {
      toast.error(getFriendlyError(error, "Couldn't update employer. Try again in a moment."));
      console.error('Failed to update employer:', error);
    }
  };

  const handleDeleteClick = () => {
    setDeleteConfirm(true);
  };

  const handleConfirmDelete = async () => {
    if (!employer) return;

    setIsDeleting(true);
    try {
      await employmentService.deleteEmployer(employer.id);
      toast.success('Employer deleted');
      navigate('/employment/employers');
    } catch (error) {
      toast.error(getFriendlyError(error, "Couldn't delete employer. Try again in a moment."));
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(false);
  };

  if (loading) {
    return (
      <Card className="flex justify-center py-12">
        <LoadingSpinner />
      </Card>
    );
  }

  if (!employer) {
    return (
      <Card>
        <EmptyState title="Employer not found" description="This employer may have been removed." />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={employer.name}
        leading={<Avatar name={employer.name} size={56} />}
        description="Employer profile and contact details"
        actions={
          !isEditing && (
            <>
              <Button variant="secondary" onClick={() => navigate('/employment/employers')}>
                Back
              </Button>
              <Button onClick={() => setIsEditing(true)}>Edit</Button>
              <Button variant="danger" onClick={handleDeleteClick}>
                Delete
              </Button>
            </>
          )
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard variant="inline" title="Business Type" value={employer.businessType || '—'} icon={<FiBriefcase className="h-[17px] w-[17px]" />} tone="green" />
        <StatCard variant="inline" title="Contact Person" value={employer.contactPerson || '—'} icon={<FiUser className="h-[17px] w-[17px]" />} tone="lime" />
        <StatCard variant="inline" title="Status" value={<StatusBadge status={employer.status} />} summary={`Status: ${employer.status}`} />
      </div>

      <Card padding="none">
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-5 p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Input label="Employer Name" type="text" name="name" value={formData.name || ''} onChange={handleChange} />
              </div>

              <div>
                <Input label="Business Type" type="text" name="businessType" value={formData.businessType || ''} onChange={handleChange} />
              </div>

              <div>
                <Input label="Contact Person" type="text" name="contactPerson" value={formData.contactPerson || ''} onChange={handleChange} />
              </div>

              <div>
                <Input label="Contact Number" type="tel" name="contactNo" value={formData.contactNo || ''} onChange={handleChange} />
              </div>

              <div>
                <Input label="Location" type="text" name="location" value={formData.location || ''} onChange={handleChange} />
              </div>

              <div>
                <label className={labelClasses}>Status</label>
                <select
                  name="status"
                  value={formData.status || 'active'}
                  onChange={handleChange}
                  className={`${controlClasses} h-9`}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelClasses}>Notes</label>
              <textarea
                name="notes"
                value={formData.notes || ''}
                onChange={handleChange}
                rows={3}
                className={`${controlClasses} py-2`}
              />
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
          <div className="space-y-5 p-5">
            <div>
              <h3 className="mb-2 text-sm font-bold text-[#18231E] dark:text-surface-text">Details</h3>
              <div className="space-y-3 text-[13px] text-[#3A4741] dark:text-surface-text">
                {employer.contactNo && (
                  <div>
                    <span className="font-medium">Phone:</span> {employer.contactNo}
                  </div>
                )}
                {employer.location && (
                  <div>
                    <span className="font-medium">Location:</span> {employer.location}
                  </div>
                )}
                {employer.notes && (
                  <div>
                    <span className="font-medium">Notes:</span>
                    <p className="mt-1 whitespace-pre-wrap">{employer.notes}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="text-xs text-[#7B8983] dark:text-surface-muted">
              Added on {new Date(employer.createdAt).toLocaleDateString()}
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog
        isOpen={deleteConfirm}
        title="Delete employer?"
        message={employer ? `Delete employer "${employer.name}"?` : 'Delete this employer?'}
        consequence="This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isLoading={isDeleting}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}
