import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Avatar from '@/components/ui/Avatar';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input, { labelClasses } from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { ROUTES } from '@/constants/routes';
import { committeeService } from '@/services/committeeService';
import { memberService } from '@/services/memberService';
import { Member } from '@/types';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import UnsavedChangesDialog from '@/components/ui/UnsavedChangesDialog';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const committeeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  nameMl: z.string().optional(),
  description: z.string().optional(),
  descriptionMl: z.string().optional(),
  members: z.array(z.string()).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  termStartDate: z.string().optional(),
  termEndDate: z.string().optional(),
  maxTermYears: z.preprocess(
    (val) => (val === '' || Number.isNaN(val) ? undefined : val),
    z.number().min(1).optional()
  ),
});

type CommitteeFormData = z.infer<typeof committeeSchema>;

export default function CreateCommittee() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [memberSearch, setMemberSearch] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
    setValue,
    watch,
  } = useForm<CommitteeFormData>({
    mode: 'onTouched',
    resolver: zodResolver(committeeSchema),
    defaultValues: {
      status: 'active',
      members: [],
    },
  });
  const guard = useUnsavedChangesGuard(isDirty);

  const selectedMembers = watch('members') || [];

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    try {
      setLoadingMembers(true);
      const result = await memberService.getAll({ limit: 1000 });
      setMembers(result.data || []);
    } catch (err) {
      console.error('Error fetching members:', err);
      setMembers([]);
    } finally {
      setLoadingMembers(false);
    }
  };

  const toggleMember = (memberId: string) => {
    const current = selectedMembers || [];
    if (current.includes(memberId)) {
      setValue('members', current.filter((id) => id !== memberId), { shouldDirty: true });
    } else {
      setValue('members', [...current, memberId], { shouldDirty: true });
    }
  };

  const filteredMembers = memberSearch
    ? members.filter((member) => {
        const query = memberSearch.toLowerCase();
        return member.name.toLowerCase().includes(query) || member.familyName.toLowerCase().includes(query);
      })
    : members;

  const onSubmit = async (data: CommitteeFormData) => {
    try {
      setError(null);
      await committeeService.create({
        name: data.name,
        nameMl: data.nameMl,
        description: data.description,
        descriptionMl: data.descriptionMl,
        members: data.members || [],
        status: data.status || 'active',
        termStartDate: data.termStartDate || undefined,
        termEndDate: data.termEndDate || undefined,
        maxTermYears: data.maxTermYears,
      });
      navigate('/committees');
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create committee. Check the details and try again."));
      console.error('Error creating committee:', err);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Create Committee"
        description="Add a new committee"
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-6">
          <div>
            <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">Committee details</h2>
            <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Name, status, members and term</p>
          </div>
          {error && (
            <Alert tone="danger">{error}</Alert>
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
            <div className="hidden">
            <Input
              label="Name (Malayalam)"
              {...register('nameMl')}
              placeholder="കമ്മിറ്റിയുടെ പേര്"
              className="md:col-span-2 font-malayalam"
            />
            </div>
            <Input
              label="Description"
              {...register('description')}
              placeholder="Description"
              className="md:col-span-2"
            />
            <div className="hidden">
            <Input
              label="Description (Malayalam)"
              {...register('descriptionMl')}
              placeholder="വിവരണം"
              className="md:col-span-2 font-malayalam"
            />
            </div>
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

          <div className="md:col-span-2">
            <label className={labelClasses}>
              Members ({selectedMembers.length} selected)
            </label>
            {loadingMembers ? (
              <p className="text-sm text-[#7B8983] dark:text-surface-muted">Loading members...</p>
            ) : (
              <div className="border border-line-strong dark:border-surface-border-strong rounded-[10px] p-3.5 max-h-64 overflow-y-auto">
                <div className="mb-3">
                  <Input
                    label="Search Members"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search by member or family name"
                  />
                </div>
                {filteredMembers.length === 0 ? (
                  <p className="text-sm text-[#7B8983] dark:text-surface-muted">No members available</p>
                ) : (
                  <div className="space-y-2">
                    {filteredMembers.map((member) => (
                      <label
                        key={member.id}
                        className="flex items-center space-x-2 cursor-pointer hover:bg-mint/40 dark:hover:bg-surface-hover p-2 rounded-lg"
                      >
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(member.id)}
                          onChange={() => toggleMember(member.id)}
                          className="h-4 w-4 cursor-pointer rounded border-line-strong accent-primary-700 dark:accent-brand-lime"
                        />
                        <span className="flex items-center gap-2 text-sm text-[#3A4741] dark:text-surface-text">
                          <Avatar size={24} name={member.name} src={member.photoUrl} />
                          {member.name} ({member.familyName})
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-4">
            <h3 className="text-sm font-semibold text-[#18231E] dark:text-surface-text">Term</h3>
            <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-3">
              <Input label="Term Start Date" type="date" {...register('termStartDate')} />
              <Input label="Term End Date" type="date" {...register('termEndDate')} />
              <Input
                label="Max Term (years)"
                type="number"
                {...register('maxTermYears', { valueAsNumber: true })}
              />
            </div>
          </div>

          <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none rounded-b-card border-t border-line bg-white/90 px-4 py-3 backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button type="button" variant="secondary" onClick={() => guard.guardedNavigate('/committees')}>
              <FiX className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-3.5 w-3.5" />
              Create Committee
            </Button>
          </div>
        </Card>
      </form>
      <UnsavedChangesDialog guard={guard} />
    </div>
  );
}

