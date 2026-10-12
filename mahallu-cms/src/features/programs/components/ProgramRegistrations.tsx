import { useCallback, useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { programService, type ProgramRegistration, type RegisteredMember } from '@/services/programService';
import { memberService } from '@/services/memberService';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import Alert from '@/components/ui/Alert';
import Avatar from '@/components/ui/Avatar';

interface ProgramRegistrationsProps {
  programId: string;
}

const nameOf = (registration: ProgramRegistration): string => {
  const member = registration.memberId;
  if (typeof member === 'string') return member;
  return member?.name || '—';
};

const photoOf = (registration: ProgramRegistration): string | undefined => {
  const member = registration.memberId as any;
  return member && typeof member === 'object' ? member.photoUrl : undefined;
};

const idOf = (registration: ProgramRegistration): string => {
  const member = registration.memberId;
  return typeof member === 'string' ? member : member?.id;
};

/** Event registration list + attendance toggle (Task C3). */
export default function ProgramRegistrations({ programId }: ProgramRegistrationsProps) {
  const [registrations, setRegistrations] = useState<ProgramRegistration[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<RegisteredMember[]>([]);
  const [selectedMember, setSelectedMember] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const itemsPerPage = 10;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await programService.getRegistrations(programId, {
        page: currentPage,
        limit: itemsPerPage,
      });
      setRegistrations(res.data || []);
      setPagination(res.pagination);
    } catch (err) {
      console.error('Failed to load registrations:', err);
    } finally {
      setLoading(false);
    }
  }, [programId, currentPage]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    memberService
      .getAll({ limit: 100 })
      .then((res) => setMembers((res.data || []) as unknown as RegisteredMember[]))
      .catch((err) => console.error('Failed to load members:', err));
  }, []);

  const handleRegister = async () => {
    if (!selectedMember) return;
    setSaving(true);
    setError('');
    try {
      await programService.register(programId, selectedMember);
      setSelectedMember('');
      await load();
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't register member. Try again in a moment."));
    } finally {
      setSaving(false);
    }
  };

  const toggleAttendance = async (registration: ProgramRegistration) => {
    const memberId = idOf(registration);
    if (!memberId) return;
    try {
      await programService.setAttendance(programId, memberId, !registration.attended);
      setRegistrations((prev) =>
        prev.map((r) => (idOf(r) === memberId ? { ...r, attended: !r.attended } : r))
      );
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't update attendance. Try again in a moment."));
    }
  };

  const handleRemove = async (registration: ProgramRegistration) => {
    const memberId = idOf(registration);
    if (!memberId) return;
    try {
      await programService.removeRegistration(programId, memberId);
      await load();
      toast.success('Registration removed');
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't remove registration. Try again in a moment."));
    }
  };

  const attendedCount = registrations.filter((r) => r.attended).length;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">Registrations</h2>
        <div className="text-xs font-semibold text-[#7B8983] dark:text-surface-muted">
          {pagination?.total ?? registrations.length} registered · {attendedCount} present on this page
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="flex-1">
          <SearchableSelect
            value={selectedMember}
            onChange={setSelectedMember}
            options={members.map((m) => ({ value: m.id, label: m.name || m.id }))}
            placeholder="Search and select member"
          />
        </div>
        <Button onClick={handleRegister} disabled={!selectedMember || saving}>
          {saving ? 'Adding...' : 'Register'}
        </Button>
      </div>

      {error && <Alert tone="danger" className="mb-3">{error}</Alert>}

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <LoadingSpinner />
        </div>
      ) : registrations.length === 0 ? (
        <EmptyState title="No registrations yet" description="Registered members will appear here." />
      ) : (
        <div className="divide-y divide-line-soft dark:divide-surface-border">
          {registrations.map((r) => (
            <div key={idOf(r)} className="flex items-center justify-between gap-3 py-3">
              <label className="flex items-center gap-3 min-w-0">
                <input
                  type="checkbox"
                  checked={r.attended}
                  onChange={() => toggleAttendance(r)}
                  className="h-4 w-4 cursor-pointer rounded border-line-strong accent-primary-700 dark:accent-brand-lime"
                />
                <Avatar size={32} name={nameOf(r)} src={photoOf(r)} />
                <span className="truncate text-[13px] font-semibold text-[#18231E] dark:text-surface-text">{nameOf(r)}</span>
              </label>
              <Button type="button" variant="danger" size="sm" onClick={() => handleRemove(r)} className="shrink-0">
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            currentPage={currentPage}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </Card>
  );
}
