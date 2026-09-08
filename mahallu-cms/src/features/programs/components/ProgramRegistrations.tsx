import { useCallback, useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Pagination from '@/components/ui/Pagination';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { programService, type ProgramRegistration, type RegisteredMember } from '@/services/programService';
import { memberService } from '@/services/memberService';
import { toast } from '@/store/toastStore';
import { errorMessage } from '@/utils/errors';

interface ProgramRegistrationsProps {
  programId: string;
}

const nameOf = (registration: ProgramRegistration): string => {
  const member = registration.memberId;
  if (typeof member === 'string') return member;
  return member?.name || '—';
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
      console.error("Couldn't load registrations:", err);
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
      .catch((err) => console.error("Couldn't load members:", err));
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
      setError(errorMessage(err, { action: 'register member' }));
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
      toast.error(errorMessage(err, { action: 'update attendance' }));
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
      toast.error(errorMessage(err, { action: 'remove registration' }));
    }
  };

  const attendedCount = registrations.filter((r) => r.attended).length;

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-lg font-semibold">Registrations</h2>
        <div className="text-xs sm:text-sm text-gray-600">
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

      {error && <div className="mb-3 text-sm text-red-600">{error}</div>}

      {loading ? (
        <div className="py-6 text-center text-gray-500">Loading...</div>
      ) : registrations.length === 0 ? (
        <div className="py-6 text-center text-gray-500">No registrations yet</div>
      ) : (
        <div className="divide-y">
          {registrations.map((r) => (
            <div key={idOf(r)} className="flex items-center justify-between gap-3 py-3">
              <label className="flex items-center gap-3 min-w-0">
                <input
                  aria-label="Select row"
                  type="checkbox"
                  checked={r.attended}
                  onChange={() => toggleAttendance(r)}
                  className="h-5 w-5 rounded border-gray-300"
                />
                <span className="truncate text-sm sm:text-base">{nameOf(r)}</span>
              </label>
              <button
                type="button"
                onClick={() => handleRemove(r)}
                className="text-xs sm:text-sm text-red-600 hover:underline shrink-0"
              >
                Remove
              </button>
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
