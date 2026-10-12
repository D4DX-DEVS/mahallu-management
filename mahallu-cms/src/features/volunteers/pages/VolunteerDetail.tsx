import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { volunteerService, SERVICE_TYPE_OPTIONS, VOLUNTEER_WINGS, AVAILABILITY_OPTIONS } from '@/services/volunteerService';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/ui/PageHeader';
import Tabs from '@/components/ui/Tabs';
import Badge from '@/components/ui/Badge';
import StatusBadge from '@/components/ui/StatusBadge';
import Avatar from '@/components/ui/Avatar';
import Alert from '@/components/ui/Alert';
import Select from '@/components/ui/Select';
import Checkbox from '@/components/ui/Checkbox';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { controlClasses, labelClasses } from '@/components/ui/Input';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

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
  const [tab, setTab] = useState<'profile' | 'history'>('profile');

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
      toast.error(getFriendlyError(err, "Couldn't update volunteer. Try again in a moment."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <LoadingSpinner className="py-12" />;
  }

  if (!volunteer) {
    return <Alert tone="danger">Volunteer not found</Alert>;
  }

  const volunteerName = typeof volunteer.memberId === 'object' ? volunteer.memberId.name : '-';
  const volunteerContact = typeof volunteer.memberId === 'object' ? volunteer.memberId.contactNo : '-';

  const labelCls = 'text-[12px] font-bold uppercase tracking-[0.04em] text-[#7B8983] dark:text-surface-muted';

  return (
    <div className="space-y-4">
      <PageHeader
        title={volunteerName}
        leading={<Avatar size={56} name={volunteerName} />}
        description="Volunteer profile"
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/volunteers')}>
              Back to volunteers
            </Button>
            {!editMode ? (
              <Button
                onClick={() => {
                  setEditMode(true);
                  setFormData(volunteer);
                  setTab('profile');
                }}
              >
                Edit
              </Button>
            ) : (
              <Button variant="secondary" onClick={() => setEditMode(false)}>
                Cancel
              </Button>
            )}
          </>
        }
      />

      <Tabs
        aria-label="Volunteer sections"
        value={tab}
        onChange={(v) => setTab(v as 'profile' | 'history')}
        tabs={[
          { value: 'profile', label: 'Profile' },
          { value: 'history', label: 'Service history' },
        ]}
      />

      {tab === 'profile' && (
        <Card padding="lg">
          {editMode && formData ? (
            <div className="space-y-5">
              {/* Wings */}
              <div>
                <p className={labelClasses}>Wings</p>
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
              </div>

              {/* Service Types */}
              <div>
                <p className={labelClasses}>Service Types</p>
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
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Availability */}
                <Select
                  label="Availability"
                  value={formData.availability}
                  onChange={(e) => setFormData((prev: any) => ({ ...prev, availability: e.target.value }))}
                  options={AVAILABILITY_OPTIONS}
                />

                {/* Status */}
                <Select
                  label="Status"
                  value={formData.status}
                  onChange={(e) => setFormData((prev: any) => ({ ...prev, status: e.target.value }))}
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'inactive', label: 'Inactive' },
                  ]}
                />
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="volunteer-notes" className={labelClasses}>Notes</label>
                <textarea
                  id="volunteer-notes"
                  value={formData.notes || ''}
                  onChange={(e) => setFormData((prev: any) => ({ ...prev, notes: e.target.value }))}
                  rows={3}
                  className={`${controlClasses} py-2`}
                />
              </div>

              {error && <Alert tone="danger">{error}</Alert>}

              <div className="flex justify-end gap-2 border-t border-line-soft pt-4 dark:border-surface-border">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 break-words min-[420px]:grid-cols-2">
                <div>
                  <p className={labelCls}>Contact</p>
                  <p className="mt-0.5 text-[13px] font-semibold text-[#18231E] dark:text-surface-text">{volunteerContact}</p>
                </div>
                <div>
                  <p className={labelCls}>Status</p>
                  <p className="mt-1">
                    <StatusBadge status={volunteer.status} />
                  </p>
                </div>
              </div>

              <div>
                <p className={labelCls + ' mb-2'}>Wings</p>
                <div className="flex flex-wrap gap-2">
                  {volunteer.wings.map((w: string) => (
                    <Badge key={w} variant="info">
                      {VOLUNTEER_WINGS.find((x) => x.value === w)?.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className={labelCls + ' mb-2'}>Service Types</p>
                <div className="flex flex-wrap gap-2">
                  {volunteer.serviceTypes.map((st: string) => (
                    <Badge key={st} variant="primary">
                      {SERVICE_TYPE_OPTIONS.find((x) => x.value === st)?.label}
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <p className={labelCls + ' mb-2'}>Availability</p>
                <p className="text-[13px] text-[#18231E] dark:text-surface-text">
                  {AVAILABILITY_OPTIONS.find((x) => x.value === volunteer.availability)?.label}
                </p>
              </div>

              {volunteer.notes && (
                <div>
                  <p className={labelCls + ' mb-2'}>Notes</p>
                  <p className="text-[13px] text-[#3A4741] dark:text-surface-text">{volunteer.notes}</p>
                </div>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Service History */}
      {tab === 'history' && (
        <Card padding="lg">
          <h3 className="mb-3.5 text-[13px] font-bold text-[#18231E] dark:text-surface-text">Service History</h3>

          {assignments.length === 0 ? (
            <EmptyState title="No assignments yet" description="Assignments for this volunteer will be listed here." />
          ) : (
            <>
              <div className="space-y-3">
                {assignments.map((assignment) => (
                  <div key={assignment.id} className="border-l-2 border-mint-deep py-1.5 pl-3 dark:border-surface-border-strong">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="text-[13px] font-semibold text-[#18231E] dark:text-surface-text">
                          {assignment.description}
                        </p>
                        <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">
                          {new Date(assignment.date).toLocaleDateString()}
                        </p>
                      </div>
                      <StatusBadge status={assignment.status} tone={assignment.status === 'assigned' ? 'info' : undefined} />
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
        </Card>
      )}
    </div>
  );
}
