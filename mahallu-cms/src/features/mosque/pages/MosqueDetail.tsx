import { useState, useEffect } from 'react';
import { FiEdit2, FiPackage, FiSave, FiTrash2 } from 'react-icons/fi';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { toast } from '@/store/toastStore';
import { ROUTES } from '@/constants/routes';
import { mosqueService, MOSQUE_FACILITY_OPTIONS, MosqueProfile } from '@/services/mosqueService';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import { FieldRule, validateForm, firstError, LIMITS } from '@/utils/validation';

/** Matches `createMosqueValidation` on the API. */
const RULES: Record<string, FieldRule> = {
  name: { label: 'mosque name', required: true, minLength: LIMITS.name.min, maxLength: LIMITS.title.max },
  nameMl: { label: 'mosque name', maxLength: LIMITS.title.max },
  capacity: { label: 'capacity', type: 'integer', min: 0, max: 100000 },
  imamName: { label: 'imam’s name', maxLength: LIMITS.name.max },
  muazzinName: { label: 'muazzin’s name', maxLength: LIMITS.name.max },
  khateebName: { label: 'khateeb’s name', maxLength: LIMITS.name.max },
  prayerFacilityNotes: { label: 'notes', maxLength: 1000 },
  staffNotes: { label: 'notes', maxLength: 1000 },
};

const emptyProfile: Omit<MosqueProfile, 'id'> = {
  name: '',
  nameMl: '',
  capacity: undefined,
  facilities: [],
  prayerFacilityNotes: '',
  imamName: '',
  muazzinName: '',
  khateebName: '',
  staffNotes: '',
};

export default function MosqueDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<MosqueProfile | null>(null);
  const [form, setForm] = useState<Omit<MosqueProfile, 'id'>>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isConfirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (!id) return;
    mosqueService
      .getById(id)
      .then((data) => {
        setProfile(data);
        setForm({ ...emptyProfile, ...data, facilities: data.facilities || [] });
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const toggleFacility = (value: string) => {
    setForm((prev) => ({
      ...prev,
      facilities: prev.facilities.includes(value)
        ? prev.facilities.filter((f) => f !== value)
        : [...prev.facilities, value],
    }));
  };

  const handleSave = async () => {
    if (!id) return;

    // Only the name was checked, and a blank one returned in silence.
    const problems = validateForm(form, RULES);
    if (Object.keys(problems).length > 0) {
      toast.error(firstError(problems));
      return;
    }

    if (saving) return; // a second click while the first save is open
    try {
      setSaving(true);
      const saved = await mosqueService.update(id, form);
      setProfile(saved);
      setForm({ ...emptyProfile, ...saved, facilities: saved.facilities || [] });
      setEditing(false);
      toast.success('Mosque profile saved');
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'save mosque profile' }));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await mosqueService.remove(id);
      toast.success('Mosque deleted');
      navigate('/mosque');
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete mosque' }));
      setConfirmDeleteOpen(false);
    }
  };

  if (loading) {
    return <PageSkeleton variant="section" />;
  }

  if (notFound || !profile) {
    return (
      <Card>
        <p className="text-red-600 dark:text-red-400">Mosque not found</p>
        <Link to="/mosque">
          <Button variant="outline" className="mt-4">
            Back to mosques
          </Button>
        </Link>
      </Card>
    );
  }

  const infoCards = [
    { label: 'Capacity', value: profile.capacity ? String(profile.capacity) : '-' },
    { label: 'Imam', value: profile.imamName || '-' },
    { label: 'Muazzin', value: profile.muazzinName || '-' },
    { label: 'Khateeb', value: profile.khateebName || '-' },
  ];

  return (
    <div className="space-y-3">
      <PageHeader
        title={toTitleCase(profile.name)}
        description="Capacity, facilities and religious staff"
        breadcrumbs={[{ label: 'Mosque', path: '/mosque' }]}
      />

      <div className="flex items-center justify-end gap-2">
        <Link to={`${ROUTES.ASSETS.LIST}?mosqueId=${profile.id}`} className="flex-shrink-0">
          <Button variant="outline" size="md" icon={<FiPackage />} collapseLabel>
            Maintenance &amp; Assets
          </Button>
        </Link>
        {editing ? (
          <Button
            size="md"
            onClick={handleSave}
            disabled={saving}
            icon={<FiSave />}
            collapseLabel
            title="Save profile"
          >
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="md"
              onClick={() => setConfirmDeleteOpen(true)}
              icon={<FiTrash2 />}
              collapseLabel
            >
              Delete Mosque
            </Button>
            <Button size="md" onClick={() => setEditing(true)} icon={<FiEdit2 />} collapseLabel>
              Edit Profile
            </Button>
          </>
        )}
      </div>

      {editing ? (
        <Card>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Mosque Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <Input
              label="Name (Malayalam)"
              value={form.nameMl || ''}
              onChange={(e) => setForm({ ...form, nameMl: e.target.value })}
              className="font-malayalam"
            />
            <Input
              label="Capacity"
              type="number"
              value={form.capacity != null ? String(form.capacity) : ''}
              onChange={(e) =>
                setForm({ ...form, capacity: e.target.value ? Number(e.target.value) : undefined })
              }
            />
            <Input
              label="Imam Name"
              value={form.imamName || ''}
              onChange={(e) => setForm({ ...form, imamName: e.target.value })}
            />
            <Input
              label="Muazzin Name"
              value={form.muazzinName || ''}
              onChange={(e) => setForm({ ...form, muazzinName: e.target.value })}
            />
            <Input
              label="Khateeb Name"
              value={form.khateebName || ''}
              onChange={(e) => setForm({ ...form, khateebName: e.target.value })}
            />
            <div className="md:col-span-2">
              <Input
                label="Prayer Facility Notes"
                value={form.prayerFacilityNotes || ''}
                onChange={(e) => setForm({ ...form, prayerFacilityNotes: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Input
                label="Staff Notes"
                value={form.staffNotes || ''}
                onChange={(e) => setForm({ ...form, staffNotes: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Facilities</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {MOSQUE_FACILITY_OPTIONS.map((option) => {
                const active = form.facilities.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleFacility(option.value)}
                    className={[
                      'rounded-xl border px-2.5 py-2 text-left text-xs font-medium leading-tight sm:text-sm',
                      active
                        ? 'border-primary-300 bg-primary-50 text-primary-900'
                        : 'border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {infoCards.map((card) => (
              <Card key={card.label}>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 sm:text-sm">
                  {card.label}
                </p>
                <p className="mt-1 break-words text-sm font-semibold text-gray-900 dark:text-gray-100 sm:text-base">
                  {card.label !== 'Capacity' ? toTitleCase(card.value) : card.value}
                </p>
              </Card>
            ))}
          </div>

          <Card>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Facilities</p>
            {profile.facilities.length === 0 ? (
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">None recorded</p>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {profile.facilities.map((value) => (
                  <div
                    key={value}
                    className="rounded-xl border border-primary-200 bg-primary-50 px-2.5 py-2 text-xs font-medium text-primary-900 sm:text-sm"
                  >
                    {MOSQUE_FACILITY_OPTIONS.find((o) => o.value === value)?.label || value}
                  </div>
                ))}
              </div>
            )}
            {profile.prayerFacilityNotes && (
              <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{profile.prayerFacilityNotes}</p>
            )}
            {profile.staffNotes && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{profile.staffNotes}</p>
            )}
          </Card>
        </>
      )}

      <ConfirmDialog
        isLoading={saving}
        isOpen={isConfirmDeleteOpen}
        title="Delete Mosque"
        message={`Delete "${toTitleCase(profile.name)}"? Its assets will remain but become unassigned.`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
}
