import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiSave, FiX } from 'react-icons/fi';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { committeeService } from '@/services/committeeService';
import { memberService } from '@/services/memberService';
import { Member } from '@/types';
import { errorMessage } from '@/utils/errors';

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
      memberService
        .getAll()
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
    ? members.filter(
        (m) =>
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
      setError(errorMessage(err, { action: 'create committee. please try again' }));
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Add New Committee" size="xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
            {error}
          </div>
        )}

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
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Members ({selectedMembers.length} selected)
          </label>
          {loadingMembers ? (
            <p className="text-sm text-gray-500">Loading members...</p>
          ) : (
            <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 max-h-52 overflow-y-auto">
              <div className="mb-3">
                <Input
                  label="Search Members"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search by member or family name"
                />
              </div>
              {filteredMembers.length === 0 ? (
                <p className="text-sm text-gray-500">No members found</p>
              ) : (
                <div className="space-y-2">
                  {filteredMembers.map((member) => (
                    <label
                      key={member.id}
                      className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 p-2 rounded"
                    >
                      <input
                        aria-label="Select row"
                        type="checkbox"
                        checked={selectedMembers.includes(member.id)}
                        onChange={() => toggleMember(member.id)}
                        className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {member.name} ({member.familyName})
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="outline" onClick={onClose}>
            <FiX className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            <FiSave className="h-4 w-4 mr-2" />
            Create Committee
          </Button>
        </div>
      </form>
    </Modal>
  );
}
