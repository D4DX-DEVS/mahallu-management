import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { volunteerService, SERVICE_TYPE_OPTIONS } from '@/services/volunteerService';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { errorMessage } from '@/utils/errors';
import { useFormValidation } from '@/hooks/useFormValidation';
import { FieldRule, LIMITS, firstError, validateForm } from '@/utils/validation';
import PageHeader from '@/components/layout/PageHeader';

/**
 * The same limits the API applies, so a form that passes here is not
 * refused there. Required matches what each input already declares.
 */
const RULES: Record<string, FieldRule> = {
  serviceType: { label: 'service type', required: true, maxLength: LIMITS.shortText.max },
  date: { label: 'assignment date', required: true, type: 'date' },
  description: { label: 'description', required: true, maxLength: LIMITS.description.max },
  status: { label: 'status', maxLength: LIMITS.shortText.max },
};

const today = () => new Date().toISOString().slice(0, 16);

export default function AssignmentCreate() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    volunteerIds: [] as string[],
    serviceType: '',
    date: today(),
    description: '',
    status: 'assigned',
  });
  const { errors, setErrors } = useFormValidation(RULES);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingVolunteers, setLoadingVolunteers] = useState(true);
  const [loadingAssignment, setLoadingAssignment] = useState(isEdit);

  useEffect(() => {
    const fetchVolunteers = async () => {
      try {
        const result = await volunteerService.getVolunteers({
          page: 1,
          limit: 500,
          status: 'active',
        });
        setVolunteers(result.data);
      } catch (err) {
        console.error("Couldn't load volunteers:", err);
      } finally {
        setLoadingVolunteers(false);
      }
    };

    fetchVolunteers();
  }, []);

  useEffect(() => {
    if (!id) return;
    const fetchAssignment = async () => {
      try {
        setLoadingAssignment(true);
        const assignment = await volunteerService.getAssignment(id);
        setFormData({
          volunteerIds: assignment.volunteerIds.map((v: any) => (typeof v === 'object' ? v.id : v)),
          serviceType: assignment.serviceType,
          date: assignment.date ? new Date(assignment.date).toISOString().slice(0, 16) : today(),
          description: assignment.description,
          status: assignment.status,
        });
      } catch (err) {
        console.error("Couldn't load assignment:", err);
        setError("Couldn't load assignment");
      } finally {
        setLoadingAssignment(false);
      }
    };

    fetchAssignment();
  }, [id]);

  const toggleVolunteer = (volunteerId: string) => {
    setFormData((prev) => ({
      ...prev,
      volunteerIds: prev.volunteerIds.includes(volunteerId)
        ? prev.volunteerIds.filter((v) => v !== volunteerId)
        : [...prev.volunteerIds, volunteerId],
    }));
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
    if (formData.volunteerIds.length === 0 || !formData.serviceType || !formData.description) {
      setError('At least one volunteer, a service type, and description are required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      if (isEdit && id) {
        await volunteerService.updateAssignment(id, formData);
      } else {
        await volunteerService.createAssignment(formData);
      }
      navigate('/volunteers/assignments');
    } catch (err: any) {
      setError(errorMessage(err, { action: `${isEdit ? 'update' : 'create'} assignment` }));
    } finally {
      setSaving(false);
    }
  };

  const volunteerName = (v: any) => {
    if (v.memberId && typeof v.memberId === 'object') {
      return `${v.memberId.name}`;
    }
    return '-';
  };

  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader title="New assignment" breadcrumbs={[{ label: 'Volunteers', path: '/volunteers' }]} />
      <Card>
        <div>
          <h2 className="text-xl font-semibold mb-6">{isEdit ? 'Edit Assignment' : 'Create Assignment'}</h2>

          {loadingAssignment ? (
            <p className="text-gray-500">Loading assignment...</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Volunteer Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Select Volunteers *</label>
                {loadingVolunteers ? (
                  <p className="text-gray-500">Loading volunteers...</p>
                ) : volunteers.length === 0 ? (
                  <p className="text-red-600">No active volunteers found</p>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3">
                    {volunteers.map((volunteer) => (
                      <label key={volunteer.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          aria-label="Select row"
                          type="checkbox"
                          checked={formData.volunteerIds.includes(volunteer.id)}
                          onChange={() => toggleVolunteer(volunteer.id)}
                          className="w-4 h-4 rounded border-gray-300"
                        />
                        <span className="text-sm text-gray-700">
                          {volunteerName(volunteer)}
                          {volunteer.wings && (
                            <span className="text-xs text-gray-500 ml-2">({volunteer.wings.join(', ')})</span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {formData.volunteerIds.length > 0 && (
                  <p className="text-xs text-gray-600 mt-2">
                    {formData.volunteerIds.length} volunteer{formData.volunteerIds.length !== 1 ? 's' : ''}
                    selected
                  </p>
                )}
              </div>

              {/* Service Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Service Type *</label>
                <select
                  aria-label="Service Type"
                  value={formData.serviceType}
                  onChange={(e) => setFormData((prev) => ({ ...prev, serviceType: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select service type</option>
                  {SERVICE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date and Time *</label>
                <input
                  aria-label="Date and Time"
                  type="datetime-local"
                  value={formData.date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                <textarea
                  aria-label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder="Details about the assignment..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  aria-label="Status"
                  value={formData.status}
                  onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="assigned">Assigned</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>}

              <div className="flex flex-wrap gap-3 pt-4">
                <Button type="submit" disabled={saving || loadingVolunteers}>
                  {saving
                    ? isEdit
                      ? 'Saving...'
                      : 'Creating...'
                    : isEdit
                      ? 'Save Changes'
                      : 'Create Assignment'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => navigate('/volunteers/assignments')}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      </Card>
    </div>
  );
}
