import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { volunteerService, SERVICE_TYPE_OPTIONS, VOLUNTEER_WINGS, AVAILABILITY_OPTIONS } from '@/services/volunteerService';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';

export default function VolunteerDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [volunteer, setVolunteer] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignmentsPage, setAssignmentsPage] = useState(1);
  const [assignmentsTotalPages, setAssignmentsTotalPages] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const vol = await volunteerService.getVolunteer(id);
        setVolunteer(vol);
        setFormData(vol);

        const result = await volunteerService.getVolunteerAssignments(id, {
          page: assignmentsPage,
          limit: 5,
        });
        setAssignments(result.data);
        setAssignmentsTotalPages(result.pagination?.totalPages || 1);
      } catch (err) {
        console.error('Failed to fetch data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, assignmentsPage]);

  const toggleWing = (wing: string) => {
    if (!formData) return;
    setFormData((prev: any) => ({
      ...prev,
      wings: prev.wings.includes(wing)
        ? prev.wings.filter((w: string) => w !== wing)
        : [...prev.wings, wing],
    }));
  };

  const toggleServiceType = (st: string) => {
    if (!formData) return;
    setFormData((prev: any) => ({
      ...prev,
      serviceTypes: prev.serviceTypes.includes(st)
        ? prev.serviceTypes.filter((s: string) => s !== st)
        : [...prev.serviceTypes, st],
    }));
  };

  const handleSave = async () => {
    if (!id || !formData) return;
    try {
      setSaving(true);
      setError(null);
      const updated = await volunteerService.updateVolunteer(id, formData);
      setVolunteer(updated);
      setEditMode(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update volunteer');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Card><div className="p-8 text-center">Loading...</div></Card>;
  }

  if (!volunteer) {
    return <Card><div className="p-8 text-center text-red-600">Volunteer not found</div></Card>;
  }

  const volunteerName = typeof volunteer.memberId === 'object' ? volunteer.memberId.name : '-';
  const volunteerContact = typeof volunteer.memberId === 'object' ? volunteer.memberId.contactNo : '-';

  return (
    <div className="space-y-6">
      {/* Profile Card */}
      <Card>
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-semibold">{volunteerName}</h2>
            {!editMode ? (
              <button
                onClick={() => {
                  setEditMode(true);
                  setFormData(volunteer);
                }}
                className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
              >
                Edit
              </button>
            ) : (
              <button
                onClick={() => setEditMode(false)}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Cancel
              </button>
            )}
          </div>

          {editMode && formData ? (
            <div className="space-y-6">
              {/* Wings */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Wings</label>
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

              {/* Service Types */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">Service Types</label>
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
              </div>

              {/* Availability */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                <select
                  value={formData.availability}
                  onChange={(e) => setFormData((prev: any) => ({ ...prev, availability: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {AVAILABILITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData((prev: any) => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
                <textarea
                  value={formData.notes || ''}
                  onChange={(e) => setFormData((prev: any) => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase">Contact</label>
                  <p className="text-sm font-medium text-gray-900">{volunteerContact}</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase">Status</label>
                  <p
                    className={`text-sm font-medium ${
                      volunteer.status === 'active' ? 'text-green-700' : 'text-gray-700'
                    }`}
                  >
                    {volunteer.status}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 uppercase block mb-2">Wings</label>
                <div className="flex flex-wrap gap-2">
                  {volunteer.wings.map((w: string) => (
                    <span key={w} className="bg-blue-100 text-blue-700 px-2 py-1 text-xs rounded">
                      {VOLUNTEER_WINGS.find((x) => x.value === w)?.label}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 uppercase block mb-2">Service Types</label>
                <div className="flex flex-wrap gap-2">
                  {volunteer.serviceTypes.map((st: string) => (
                    <span key={st} className="bg-green-100 text-green-700 px-2 py-1 text-xs rounded">
                      {SERVICE_TYPE_OPTIONS.find((x) => x.value === st)?.label}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 uppercase block mb-2">Availability</label>
                <p className="text-sm text-gray-900">
                  {AVAILABILITY_OPTIONS.find((x) => x.value === volunteer.availability)?.label}
                </p>
              </div>

              {volunteer.notes && (
                <div>
                  <label className="text-xs text-gray-500 uppercase block mb-2">Notes</label>
                  <p className="text-sm text-gray-700">{volunteer.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Service History */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Service History</h3>

          {assignments.length === 0 ? (
            <p className="text-gray-500 text-sm">No assignments yet</p>
          ) : (
            <>
              <div className="space-y-3">
                {assignments.map((assignment) => (
                  <div key={assignment.id} className="border-l-4 border-blue-400 pl-3 py-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {assignment.description}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(assignment.date).toLocaleDateString()}
                        </p>
                      </div>
                      <span className={`text-xs font-medium px-2 py-1 rounded whitespace-nowrap ${
                        assignment.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : assignment.status === 'cancelled'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {assignment.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <Pagination
                  currentPage={assignmentsPage}
                  totalPages={assignmentsTotalPages}
                  totalItems={assignmentsTotalPages * 5}
                  itemsPerPage={5}
                  onPageChange={setAssignmentsPage}
                />
              </div>
            </>
          )}
        </div>
      </Card>

      <div className="flex gap-2">
        <Button variant="secondary" onClick={() => navigate('/volunteers')}>
          Back to Volunteers
        </Button>
      </div>
    </div>
  );
}
