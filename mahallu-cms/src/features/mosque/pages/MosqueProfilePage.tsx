import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { toast } from '@/store/toastStore';
import { ROUTES } from '@/constants/routes';
import { mosqueService, MOSQUE_FACILITY_OPTIONS, MosqueProfile } from '@/services/mosqueService';

const emptyProfile: MosqueProfile = {
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

export default function MosqueProfilePage() {
  const [profile, setProfile] = useState<MosqueProfile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    mosqueService
      .get()
      .then((data) => {
        if (data) setProfile({ ...emptyProfile, ...data, facilities: data.facilities || [] });
        else setEditing(true);
      })
      .catch(() => setEditing(true))
      .finally(() => setLoading(false));
  }, []);

  const toggleFacility = (value: string) => {
    setProfile((prev) => ({
      ...prev,
      facilities: prev.facilities.includes(value)
        ? prev.facilities.filter((f) => f !== value)
        : [...prev.facilities, value],
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const saved = await mosqueService.save(profile);
      setProfile({ ...emptyProfile, ...saved, facilities: saved.facilities || [] });
      setEditing(false);
      toast.success('Mosque profile saved');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save mosque profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
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
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Mosque Profile</h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Capacity, facilities and religious staff
          </p>
        </div>
        <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Mosque' }]} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Link to={ROUTES.ASSETS.LIST}>
          <Button variant="outline" size="md" className="w-full sm:w-auto">
            Maintenance &amp; Assets
          </Button>
        </Link>
        {editing ? (
          <Button size="md" onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
            {saving ? 'Saving...' : 'Save Profile'}
          </Button>
        ) : (
          <Button size="md" onClick={() => setEditing(true)} className="w-full sm:w-auto">
            Edit Profile
          </Button>
        )}
      </div>

      {editing ? (
        <Card className="p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Mosque Name"
              value={profile.name || ''}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
            />
            <Input
              label="Name (Malayalam)"
              value={profile.nameMl || ''}
              onChange={(e) => setProfile({ ...profile, nameMl: e.target.value })}
              className="font-malayalam"
            />
            <Input
              label="Capacity"
              type="number"
              value={profile.capacity != null ? String(profile.capacity) : ''}
              onChange={(e) =>
                setProfile({ ...profile, capacity: e.target.value ? Number(e.target.value) : undefined })
              }
            />
            <Input
              label="Imam Name"
              value={profile.imamName || ''}
              onChange={(e) => setProfile({ ...profile, imamName: e.target.value })}
            />
            <Input
              label="Muazzin Name"
              value={profile.muazzinName || ''}
              onChange={(e) => setProfile({ ...profile, muazzinName: e.target.value })}
            />
            <Input
              label="Khateeb Name"
              value={profile.khateebName || ''}
              onChange={(e) => setProfile({ ...profile, khateebName: e.target.value })}
            />
            <div className="md:col-span-2">
              <Input
                label="Prayer Facility Notes"
                value={profile.prayerFacilityNotes || ''}
                onChange={(e) => setProfile({ ...profile, prayerFacilityNotes: e.target.value })}
              />
            </div>
            <div className="md:col-span-2">
              <Input
                label="Staff Notes"
                value={profile.staffNotes || ''}
                onChange={(e) => setProfile({ ...profile, staffNotes: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Facilities</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {MOSQUE_FACILITY_OPTIONS.map((option) => {
                const active = profile.facilities.includes(option.value);
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
    </div>
  );
}
