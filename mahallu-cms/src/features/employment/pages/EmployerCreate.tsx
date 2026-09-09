import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { employmentService } from '@/services/employmentService';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { useFormValidation } from '@/hooks/useFormValidation';
import { FieldRule, LIMITS, firstError, validateForm } from '@/utils/validation';

/**
 * The same limits the API applies, so a form that passes here is not
 * refused there. Required matches what each input already declares.
 */
const RULES: Record<string, FieldRule> = {
  name: { label: 'name', required: true, maxLength: LIMITS.title.max },
  businessType: { label: 'business type', maxLength: LIMITS.shortText.max },
  contactPerson: { label: 'contact person', maxLength: LIMITS.shortText.max },
  contactNo: { label: 'contact number', type: 'phone' },
  location: { label: 'location', maxLength: LIMITS.shortText.max },
  notes: { label: 'notes', maxLength: LIMITS.notes.max },
  status: { label: 'status', maxLength: LIMITS.shortText.max },
};

export default function EmployerCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    businessType: '',
    contactPerson: '',
    contactNo: '',
    location: '',
    notes: '',
    status: 'active',
  });
  const { errors, setErrors } = useFormValidation(RULES);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Every field checked at once. Fields rendered with this app's
    // inputs mark themselves; the rest report through the banner.
    const problems = validateForm(formData, RULES);
    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      setError(firstError(problems));
      return;
    }
    setLoading(true);
    setError('');

    try {
      await employmentService.createEmployer({
        name: formData.name,
        businessType: formData.businessType || undefined,
        contactPerson: formData.contactPerson || undefined,
        contactNo: formData.contactNo || undefined,
        location: formData.location || undefined,
        notes: formData.notes || undefined,
        status: formData.status,
      });

      navigate('/employment/employers');
    } catch (err: any) {
      setError(errorMessage(err, { action: 'create employer' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/employment/employers')}
          className="p-2 hover:bg-gray-100 rounded text-lg"
        >
          ←
        </button>
        <PageHeader title="Add New Employer" />
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Employer Name *</label>
              <input
                aria-label="Employer Name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., ABC Corporation"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Business Type</label>
              <input
                aria-label="Business Type"
                type="text"
                name="businessType"
                value={formData.businessType}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Technology, Manufacturing"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Contact Person</label>
              <input
                aria-label="Contact Person"
                type="text"
                name="contactPerson"
                value={formData.contactPerson}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Name of contact"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Contact Number</label>
              <input
                aria-label="Contact Number"
                type="tel"
                name="contactNo"
                value={formData.contactNo}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Phone number"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Location</label>
              <input
                aria-label="Location"
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Kochi, Kerala"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Status</label>
              <select
                aria-label="Status"
                name="status"
                value={formData.status}
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
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Additional notes about the employer..."
            />
          </div>

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-3">
            <Button
              type="button"
              onClick={() => navigate('/employment/employers')}
              className="bg-gray-200 text-gray-800 hover:bg-gray-300"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Employer'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
