import { useState, useEffect } from 'react';
import { FiPlus } from 'react-icons/fi';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import SearchableSelect from '@/components/ui/SearchableSelect';
import QuickAddMember from '@/components/quick-add/QuickAddMember';
import { madrasaService } from '@/services/madrasaService';
import { memberService } from '@/services/memberService';
import { errorMessage } from '@/utils/errors';

interface EnrollStudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  classId: string;
  onEnrolled: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function EnrollStudentModal({
  isOpen,
  onClose,
  classId,
  onEnrolled,
}: EnrollStudentModalProps) {
  const [members, setMembers] = useState<any[]>([]);
  const [memberId, setMemberId] = useState('');
  const [rollNo, setRollNo] = useState('');
  const [enrollDate, setEnrollDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    memberService
      .getAll({ page: 1, limit: 200 } as any)
      .then((result: any) => setMembers(result.data || []))
      .catch(() => setMembers([]));
  }, [isOpen]);

  const submit = async () => {
    if (!memberId) return;
    try {
      setSaving(true);
      setError(null);
      await madrasaService.createEnrollment({
        classId,
        memberId,
        rollNo: rollNo || undefined,
        enrollDate,
      });
      setMemberId('');
      setRollNo('');
      setEnrollDate(today());
      onEnrolled();
      onClose();
    } catch (err: any) {
      setError(errorMessage(err, { action: 'enroll the student' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Enroll a student"
      footer={
        <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-2">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!memberId || saving}>
            {saving ? 'Saving...' : 'Enroll'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <SearchableSelect
              label="Student"
              value={memberId}
              onChange={setMemberId}
              options={members.map((member: any) => ({
                value: member._id || member.id,
                label: `${member.name}${member.familyName ? ` - ${member.familyName}` : ''}`,
              }))}
              placeholder="Search members..."
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

        <Input
          label="Roll number"
          value={rollNo}
          onChange={(e) => setRollNo(e.target.value)}
          placeholder="Optional"
        />

        <Input
          label="Enrolled on"
          type="date"
          value={enrollDate}
          onChange={(e) => setEnrollDate(e.target.value)}
        />

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}
      </div>

      <QuickAddMember
        open={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        onCreated={(newMember) => {
          setMembers((prev) => [...prev, newMember]);
          setMemberId(newMember.id);
        }}
      />
    </Modal>
  );
}
