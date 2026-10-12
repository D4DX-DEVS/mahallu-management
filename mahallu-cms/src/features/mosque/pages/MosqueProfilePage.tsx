import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import { FiUsers, FiUser } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
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
      toast.error(getFriendlyError(err, "Couldn't save mosque profile. Check the details and try again."));
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
    { label: 'Capacity', value: profile.capacity ? String(profile.capacity) : '-', icon: <FiUsers className="h-[17px] w-[17px]" />, tone: 'green' as const },
    { label: 'Imam', value: profile.imamName || '-', icon: <FiUser className="h-[17px] w-[17px]" />, tone: 'lime' as const },
    { label: 'Muazzin', value: profile.muazzinName || '-', icon: <FiUser className="h-[17px] w-[17px]" />, tone: 'neutral' as const },
    { label: 'Khateeb', value: profile.khateebName || '-', icon: <FiUser className="h-[17px] w-[17px]" />, tone: 'neutral' as const },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mosque profile"
        description="Capacity, facilities and religious staff"
        actions={
          <>
            <Link to={ROUTES.ASSETS.LIST}>
              <Button variant="secondary">Maintenance &amp; Assets</Button>
            </Link>
            {editing ? (
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Profile'}
              </Button>
            ) : (
              <Button onClick={() => setEditing(true)}>Edit Profile</Button>
            )}
          </>
        }
      />

      {editing ? (
        <Card padding="lg">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Mosque details</h2>
            <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Name, capacity and religious staff</p>
          </div>
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
            <p className="text-sm font-bold text-[#18231E] dark:text-surface-text">Facilities</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
              {MOSQUE_FACILITY_OPTIONS.map((option) => {
                const active = profile.facilities.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleFacility(option.value)}
                    className={[
                      'rounded-xl border px-2.5 py-2 max-sm:min-h-10 text-left text-xs font-semibold leading-tight transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28]',
                      active
                        ? 'border-primary-600 bg-mint text-primary-700 dark:border-brand-lime dark:bg-brand-lime/15 dark:text-brand-lime'
                        : 'border-line bg-white text-[#5B6963] hover:border-line-strong dark:border-surface-border dark:bg-surface-raised dark:text-surface-muted',
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
              <StatCard key={card.label} variant="inline" title={card.label} value={card.value} icon={card.icon} tone={card.tone} />
            ))}
          </div>

          <Card padding="lg">
            <p className="text-sm font-bold text-[#18231E] dark:text-surface-text">Facilities</p>
            {profile.facilities.length === 0 ? (
              <p className="mt-1 text-[13px] text-[#7B8983] dark:text-surface-muted">None recorded</p>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {profile.facilities.map((value) => (
                  <div
                    key={value}
                    className="rounded-xl border border-mint-deep bg-mint px-2.5 py-2 text-xs font-semibold text-primary-700 dark:border-brand-lime/20 dark:bg-brand-lime/10 dark:text-brand-lime"
                  >
                    {MOSQUE_FACILITY_OPTIONS.find((o) => o.value === value)?.label || value}
                  </div>
                ))}
              </div>
            )}
            {profile.prayerFacilityNotes && (
              <p className="mt-3 text-[13px] text-[#3A4741] dark:text-surface-text/80">{profile.prayerFacilityNotes}</p>
            )}
            {profile.staffNotes && (
              <p className="mt-1 text-[13px] text-[#3A4741] dark:text-surface-text/80">{profile.staffNotes}</p>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
