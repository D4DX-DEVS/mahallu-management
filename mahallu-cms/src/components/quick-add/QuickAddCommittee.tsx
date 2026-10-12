import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiSave, FiX } from 'react-icons/fi';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Avatar from '@/components/ui/Avatar';
import { committeeService } from '@/services/committeeService';
import { memberService } from '@/services/memberService';
import { Member } from '@/types';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const committeeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  members: z.array(z.string()).optional(),
});

type CommitteeFormData = z.infer<typeof committeeSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (committee: { id: string; label: string }) => void;
}

export default function QuickAddCommittee({ open, onClose, onCreated }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CommitteeFormData>({
    resolver: zodResolver(committeeSchema),
    defaultValues: { status: 'active', members: [] },
  });

  const selectedMembers = watch('members') || [];

  useEffect(() => {
    if (open) {
      setLoadingMembers(true);
      memberService.getAll()
        .then((result) => setMembers(result.data || []))
        .catch(console.error)
        .finally(() => setLoadingMembers(false));
    }
  }, [open]);

  const toggleMember = (id: string) => {
    const curr = selectedMembers;
    setValue('members', curr.includes(id) ? curr.filter((m) => m !== id) : [...curr, id]);
  };

  const filteredMembers = memberSearch
    ? members.filter((m) =>
        m.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
        m.familyName.toLowerCase().includes(memberSearch.toLowerCase())
      )
    : members;

  const onSubmit = async (data: CommitteeFormData) => {
    try {
      setError(null);
      const created = await committeeService.create({
        name: data.name,
        description: data.description,
        members: data.members || [],
        status: data.status || 'active',
      });
      onCreated({ id: created.id, label: created.name });
      onClose();
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create committee. Check the details and try again."));
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Add New Committee" size="xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Name"
            {...register('name')}
            error={errors.name?.message}
            required
            placeholder="Committee Name"
            className="md:col-span-2"
          />
          <Input
            label="Description"
            {...register('description')}
            placeholder="Description"
            className="md:col-span-2"
          />
          <Select
            label="Status"
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
            {...register('status')}
            className="md:col-span-2"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[#3A4741] dark:text-surface-text/80">
            Members ({selectedMembers.length} selected)
          </label>
          {loadingMembers ? (
            <p className="text-[13px] text-[#7B8983] dark:text-surface-muted">Loading members...</p>
          ) : (
            <div className="max-h-52 overflow-y-auto rounded-xl border border-line p-3.5 dark:border-surface-border">
              <div className="mb-3">
                <Input
                  label="Search Members"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search by member or family name"
                />
              </div>
              {filteredMembers.length === 0 ? (
                <p className="text-[13px] text-[#7B8983] dark:text-surface-muted">No members found</p>
              ) : (
                <div className="space-y-2">
                  {filteredMembers.map((member) => (
                    <label
                      key={member.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg p-2 hover:bg-[#F4F7F5] dark:hover:bg-surface-hover"
                    >
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(member.id)}
                        onChange={() => toggleMember(member.id)}
                        className="h-4 w-4 rounded border-line-strong accent-primary-600"
                      />
                      <Avatar name={member.name} src={member.photoUrl} size={24} />
                      <span className="text-[13px] text-[#3A4741] dark:text-surface-text">
                        {member.name} ({member.familyName})
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-line-soft pt-4 dark:border-surface-border">
          <Button type="button" variant="secondary" onClick={onClose}>
            <FiX className="h-3.5 w-3.5" />
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            <FiSave className="h-3.5 w-3.5" />
            Create Committee
          </Button>
        </div>
      </form>
    </Modal>
  );
}
