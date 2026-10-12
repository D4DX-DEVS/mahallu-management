import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import { volunteerService, SERVICE_TYPE_OPTIONS, VOLUNTEER_WINGS, AVAILABILITY_OPTIONS } from '@/services/volunteerService';
import { memberService } from '@/services/memberService';
import QuickAddMember from '@/components/quick-add/QuickAddMember';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import SearchableSelect from '@/components/ui/SearchableSelect';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import Select from '@/components/ui/Select';
import Checkbox from '@/components/ui/Checkbox';
import { controlClasses, labelClasses } from '@/components/ui/Input';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

export default function VolunteerCreate() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    memberId: '',
    wings: [] as string[],
    serviceTypes: [] as string[],
    availability: 'anytime',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const result = await memberService.getAll({ page: 1, limit: 500 } as any);
        setMembers(result.data || []);
      } catch (err) {
        console.error('Failed to fetch members:', err);
      } finally {
        setLoadingMembers(false);
      }
    };

    fetchMembers();
  }, []);

  const toggleWing = (wing: string) => {
    setFormData((prev) => ({
      ...prev,
      wings: prev.wings.includes(wing)
        ? prev.wings.filter((w) => w !== wing)
        : [...prev.wings, wing],
    }));
  };

  const toggleServiceType = (st: string) => {
    setFormData((prev) => ({
      ...prev,
      serviceTypes: prev.serviceTypes.includes(st)
        ? prev.serviceTypes.filter((s) => s !== st)
        : [...prev.serviceTypes, st],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.memberId || formData.wings.length === 0 || formData.serviceTypes.length === 0) {
      setError('Member, at least one wing, and at least one service type are required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await volunteerService.createVolunteer(formData);
      navigate('/volunteers');
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create volunteer. Check the details and try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Add volunteer" description="Register a member as a volunteer" />

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        {/* Member Picker */}
        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Member</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Pick the member who is volunteering</p>
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <SearchableSelect
                label="Member *"
                value={formData.memberId}
                onChange={(v) => setFormData((prev) => ({ ...prev, memberId: v }))}
                options={members.map((m) => ({
                  value: m.id,
                  label: `${m.name}${m.familyName ? ` (${m.familyName})` : ''}`,
                }))}
                placeholder={loadingMembers ? 'Loading members...' : 'Search and select member'}
                disabled={loadingMembers}
              />
            </div>
            <Button
              type="button"
              variant="secondary"
              iconOnly
              onClick={() => setAddMemberOpen(true)}
              title="Add a new member"
              aria-label="Add a new member"
            >
              <FiPlus className="h-4 w-4" />
            </Button>
          </div>
        </Card>

        {/* Wings Selection */}
        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Wings *</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Choose at least one wing</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {VOLUNTEER_WINGS.map((wing) => (
              <Checkbox
                key={wing.value}
                label={wing.label}
                checked={formData.wings.includes(wing.value)}
                onChange={() => toggleWing(wing.value)}
              />
            ))}
          </div>
        </Card>

        {/* Service Types Selection */}
        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Service types *</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Choose at least one type of service</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {SERVICE_TYPE_OPTIONS.map((st) => (
              <Checkbox
                key={st.value}
                label={st.label}
                checked={formData.serviceTypes.includes(st.value)}
                onChange={() => toggleServiceType(st.value)}
              />
            ))}
          </div>
          {error && error.includes('service type') && (
            <p role="alert" className="mt-2 text-[12px] font-medium text-[#B3261E] dark:text-red-300">{error}</p>
          )}
        </Card>

        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Availability</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">When the volunteer can help</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Availability */}
            <Select
              label="Availability"
              value={formData.availability}
              onChange={(e) => setFormData((prev) => ({ ...prev, availability: e.target.value }))}
              options={AVAILABILITY_OPTIONS}
            />

            {/* Notes */}
            <div className="md:col-span-2">
              <label htmlFor="volunteer-notes" className={labelClasses}>Notes</label>
              <textarea
                id="volunteer-notes"
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes about the volunteer..."
                rows={3}
                className={`${controlClasses} py-2`}
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/volunteers')}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Create Volunteer'}
          </Button>
        </div>
      </form>

      <QuickAddMember
        open={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        onCreated={(newMember) => {
          setMembers((prev) => [...prev, newMember]);
          setFormData({ ...formData, memberId: newMember.id });
        }}
      />
    </div>
  );
}
