import { useEffect, useState } from 'react';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import { useParams, useNavigate } from 'react-router-dom';
import { employmentService, type Employer } from '@/services/employmentService';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { FieldRule, LIMITS, validateForm, firstError } from '@/utils/validation';
import { toTitleCase } from '@/utils/format';

/** The same rules the create form and the API apply. */
const RULES: Record<string, FieldRule> = {
  name: { label: 'employer name', required: true, minLength: LIMITS.name.min, maxLength: LIMITS.title.max },
  businessType: { label: 'business type', maxLength: 100 },
  contactPerson: { label: 'contact person', maxLength: 100 },
  contactNo: { label: 'contact number', type: 'phone' },
  location: { label: 'location', maxLength: LIMITS.shortText.max },
  notes: { label: 'notes', maxLength: LIMITS.notes.max },
};

export default function EmployerEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employer, setEmployer] = useState<Employer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
        console.error("Couldn't load employer:", error);
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

  // Save had no in-flight guard: a second click while the first request was
  // still open fired the same update again.
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || saving) return;

    // Save had no checks at all: a blank name, a 5,000-character note or a
    // contact number reading "call the office" all went straight to the API.
    // These fields are raw inputs, so the message goes where this page already
    // puts its messages.
    const problems = validateForm(formData, RULES);
    if (Object.keys(problems).length > 0) {
      toast.error(firstError(problems));
      return;
    }

    setSaving(true);

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
      toast.error(errorMessage(error, { action: 'update the employer' }));
      console.error("Couldn't update employer:", error);
    } finally {
      setSaving(false);
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
      const message = errorMessage(error, { action: 'delete this employer' });
      toast.error(message);
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(false);
  };

  if (loading) {
    return <Card className="p-5 text-center">Loading employer details...</Card>;
  }

  if (!employer) {
    return (
      <Card className="p-5 text-center text-gray-500">
        <p>Employer not found</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate('/employment/employers')}
            className="p-2 hover:bg-gray-100 rounded text-lg"
          >
            ←
          </button>
          <PageHeader title={toTitleCase(employer.name)} />
        </div>
        <div className="flex gap-2 items-center">
          {!isEditing && (
            <>
              <Button onClick={() => setIsEditing(true)} className="bg-blue-600 text-white" icon={<FiEdit2 />} collapseLabel>Edit</Button>
              <Button onClick={handleDeleteClick} className="bg-red-600 text-white" icon={<FiTrash2 />} collapseLabel>Delete</Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="text-xs text-gray-600">Business Type</div>
          <div className="font-semibold text-gray-900">{employer.businessType ? toTitleCase(employer.businessType) : '—'}</div>
        </Card>
        <Card>
          <div className="text-xs text-gray-600">Contact Person</div>
          <div className="font-semibold text-gray-900">{employer.contactPerson ? toTitleCase(employer.contactPerson) : '—'}</div>
        </Card>
        <Card>
          <div className="text-xs text-gray-600">Status</div>
          <div className="font-semibold text-gray-900 capitalize">{employer.status}</div>
        </Card>
      </div>

      <Card>
        {isEditing ? (
          <form onSubmit={handleSave} className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Employer Name</label>
                <input
                  aria-label="Employer Name"
                  type="text"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Business Type</label>
                <input
                  aria-label="Business Type"
                  type="text"
                  name="businessType"
                  value={formData.businessType || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Contact Person</label>
                <input
                  aria-label="Contact Person"
                  type="text"
                  name="contactPerson"
                  value={formData.contactPerson || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Contact Number</label>
                <input
                  aria-label="Contact Number"
                  type="tel"
                  name="contactNo"
                  value={formData.contactNo || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Location</label>
                <input
                  aria-label="Location"
                  type="text"
                  name="location"
                  value={formData.location || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Status</label>
                <select
                  aria-label="Status"
                  name="status"
                  value={formData.status || 'active'}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Notes</label>
              <textarea
                aria-label="Notes"
                name="notes"
                value={formData.notes || ''}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
            <div>
              <h3 className="font-semibold mb-2 text-foreground">Details</h3>
              <div className="space-y-3 text-sm text-gray-700">
                {employer.contactNo && (
                  <div>
                    <span className="font-medium">Phone:</span> {employer.contactNo}
                  </div>
                )}
                {employer.location && (
                  <div>
                    <span className="font-medium">Location:</span> {toTitleCase(employer.location)}
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

            <div className="text-sm text-gray-500">
              Added on {new Date(employer.createdAt).toLocaleDateString()}
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog
        isOpen={deleteConfirm}
        title="Delete Employer"
        message={employer ? `Delete employer "${toTitleCase(employer.name)}"?` : 'Delete this employer?'}
        consequence="This action cannot be undone."
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
