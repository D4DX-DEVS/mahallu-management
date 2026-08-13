import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import { volunteerService, SERVICE_TYPE_OPTIONS, VOLUNTEER_WINGS, AVAILABILITY_OPTIONS } from '@/services/volunteerService';
import { memberService } from '@/services/memberService';
import QuickAddMember from '@/components/quick-add/QuickAddMember';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import SearchableSelect from '@/components/ui/SearchableSelect';

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
      setError(err.response?.data?.message || 'Failed to create volunteer');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-semibold mb-6">Add Volunteer</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Member Picker */}
            <div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <SearchableSelect
                    label="Member *"
                    value={formData.memberId}
                    onChange={(v) => setFormData((prev) => ({ ...prev, memberId: v }))}
                    options={members.map((m) => ({
                      value: m._id,
                      label: `${m.name}${m.familyName ? ` (${m.familyName})` : ''}`,
                    }))}
                    placeholder={loadingMembers ? 'Loading members...' : 'Search and select member'}
                    disabled={loadingMembers}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAddMemberOpen(true)}
                  title="Add a new member"
                >
                  <FiPlus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Wings Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Wings *</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {VOLUNTEER_WINGS.map((wing) => (
                  <label key={wing.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.wings.includes(wing.value)}
                      onChange={() => toggleWing(wing.value)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">{wing.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Service Types Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">Service Types *</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {SERVICE_TYPE_OPTIONS.map((st) => (
                  <label key={st.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.serviceTypes.includes(st.value)}
                      onChange={() => toggleServiceType(st.value)}
                      className="w-4 h-4 rounded border-gray-300"
                    />
                    <span className="text-sm text-gray-700">{st.label}</span>
                  </label>
                ))}
              </div>
              {error && error.includes('service type') && (
                <p className="mt-2 text-xs text-red-600">{error}</p>
              )}
            </div>

            {/* Availability */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
              <select
                value={formData.availability}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, availability: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {AVAILABILITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes about the volunteer..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving...' : 'Create Volunteer'}
              </Button>
              <Button type="button" variant="secondary" onClick={() => navigate('/volunteers')}>
                Cancel
              </Button>
            </div>
          </form>
        </div>
      </Card>

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
