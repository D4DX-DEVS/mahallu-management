import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { toast } from '@/store/toastStore';
import { ROUTES } from '@/constants/routes';
import { mosqueService, MOSQUE_FACILITY_OPTIONS, MosqueProfile } from '@/services/mosqueService';

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
    if (!id || !form.name.trim()) {
      toast.error('Mosque name is required');
      return;
    }
    try {
      setSaving(true);
      const saved = await mosqueService.update(id, form);
      setProfile(saved);
      setForm({ ...emptyProfile, ...saved, facilities: saved.facilities || [] });
      setEditing(false);
      toast.success('Mosque profile saved');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save mosque profile');
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
      toast.error(err.response?.data?.message || 'Failed to delete mosque');
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{profile.name}</h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Capacity, facilities and religious staff
          </p>
        </div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Mosque', path: '/mosque' },
            { label: profile.name },
          ]}
        />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Link to={`${ROUTES.ASSETS.LIST}?mosqueId=${profile.id}`}>
          <Button variant="outline" size="md" className="w-full sm:w-auto">
            Maintenance &amp; Assets
          </Button>
        </Link>
        {editing ? (
          <Button size="md" onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        ) : (
          <>
            <Button
              variant="outline"
              size="md"
              className="w-full sm:w-auto"
              onClick={() => setConfirmDeleteOpen(true)}
            >
              Delete Mosque
            </Button>
            <Button size="md" onClick={() => setEditing(true)} className="w-full sm:w-auto">
              Edit Profile
            </Button>
          </>
        )}
      </div>

      {editing ? (
        <Card className="p-3 sm:p-4">
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {infoCards.map((card) => (
              <Card key={card.label} className="p-3 sm:p-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 sm:text-sm">
                  {card.label}
                </p>
                <p className="mt-1 break-words text-sm font-semibold text-gray-900 dark:text-gray-100 sm:text-base">
                  {card.value}
                </p>
              </Card>
            ))}
          </div>

          <Card className="p-3 sm:p-4">
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
        isOpen={isConfirmDeleteOpen}
        title="Delete Mosque"
        message={`Delete "${profile.name}"? Its assets will remain but become unassigned.`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />
    </div>
  );
}
