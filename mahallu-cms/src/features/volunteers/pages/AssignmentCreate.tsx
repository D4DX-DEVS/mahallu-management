import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { volunteerService, SERVICE_TYPE_OPTIONS } from '@/services/volunteerService';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import Select from '@/components/ui/Select';
import Checkbox from '@/components/ui/Checkbox';
import { controlClasses, labelClasses } from '@/components/ui/Input';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const today = () => new Date().toISOString().slice(0, 16);

export default function AssignmentCreate() {
  const navigate = useNavigate();
  const [volunteers, setVolunteers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    volunteerIds: [] as string[],
    serviceType: '',
    date: today(),
    description: '',
    status: 'assigned',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingVolunteers, setLoadingVolunteers] = useState(true);

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
        console.error('Failed to fetch volunteers:', err);
      } finally {
        setLoadingVolunteers(false);
      }
    };

    fetchVolunteers();
  }, []);

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
    if (formData.volunteerIds.length === 0 || !formData.serviceType || !formData.description) {
      setError('At least one volunteer, a service type, and description are required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await volunteerService.createAssignment(formData);
      navigate('/volunteers/assignments');
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create assignment. Check the details and try again."));
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
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Create assignment" description="Assign volunteers to a service duty" />

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        {/* Volunteer Selection */}
        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Volunteers *</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Select everyone who is on this duty</p>
          {loadingVolunteers ? (
            <p className="text-[13px] text-[#7B8983] dark:text-surface-muted">Loading volunteers...</p>
          ) : volunteers.length === 0 ? (
            <Alert tone="warning">No active volunteers found</Alert>
          ) : (
            <div className="max-h-64 space-y-2 overflow-y-auto rounded-[10px] border border-line p-3 dark:border-surface-border">
              {volunteers.map((volunteer) => (
                <Checkbox
                  key={volunteer.id}
                  checked={formData.volunteerIds.includes(volunteer.id)}
                  onChange={() => toggleVolunteer(volunteer.id)}
                  label={`${volunteerName(volunteer)}${volunteer.wings ? ` (${volunteer.wings.join(', ')})` : ''}`}
                />
              ))}
            </div>
          )}
          {formData.volunteerIds.length > 0 && (
            <p className="mt-2 text-xs text-[#5B6963] dark:text-surface-muted">
              {formData.volunteerIds.length} volunteer{formData.volunteerIds.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </Card>

        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Duty details</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Service type, date and description</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Service Type */}
            <Select
              label="Service Type *"
              value={formData.serviceType}
              onChange={(e) => setFormData((prev) => ({ ...prev, serviceType: e.target.value }))}
              options={[{ value: '', label: 'Select service type' }, ...SERVICE_TYPE_OPTIONS]}
            />

            {/* Date */}
            <Input
              label="Date and Time *"
              type="datetime-local"
              value={formData.date}
              onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
            />

            {/* Description */}
            <div className="md:col-span-2">
              <label htmlFor="assignment-description" className={labelClasses}>
                Description<span className="ml-0.5 text-[#D9534F]">*</span>
              </label>
              <textarea
                id="assignment-description"
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Details about the assignment..."
                rows={3}
                className={`${controlClasses} py-2`}
              />
            </div>

            {/* Status */}
            <Select
              label="Status"
              value={formData.status}
              onChange={(e) => setFormData((prev) => ({ ...prev, status: e.target.value }))}
              options={[
                { value: 'assigned', label: 'Assigned' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/volunteers/assignments')}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving || loadingVolunteers}>
            {saving ? 'Creating...' : 'Create Assignment'}
          </Button>
        </div>
      </form>
    </div>
  );
}
