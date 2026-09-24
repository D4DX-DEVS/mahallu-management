import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/constants/routes';
import { committeeService } from '@/services/committeeService';
import { memberService } from '@/services/memberService';
import { Member } from '@/types';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

const committeeSchema = z.object({
  name: z.string().max(200, 'Please keep the name to 200 characters or less.').min(1, 'Name is required'),
  nameMl: z.string().max(200, 'Please keep the name to 200 characters or less.').optional(),
  description: z.string().max(3000, 'Please keep the description to 3000 characters or less.').optional(),
  descriptionMl: z.string().max(3000, 'Please keep the description to 3000 characters or less.').optional(),
  members: z.array(z.string()).max(200, 'Please choose 200 members or fewer.').optional(),
  status: z.enum(['active', 'inactive']).optional(),
  termStartDate: z.string().max(200, 'Please keep the term start date to 200 characters or less.').optional(),
  termEndDate: z.string().max(200, 'Please keep the term end date to 200 characters or less.').optional(),
  maxTermYears: z.preprocess(
    (val) => (val === '' || Number.isNaN(val) ? undefined : val),
    z.number().min(1).optional()
  ),
});

type CommitteeFormData = z.infer<typeof committeeSchema>;

export default function EditCommittee() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [memberSearch, setMemberSearch] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
    watch,
  } = useForm<CommitteeFormData>({
    resolver: zodResolver(committeeSchema),
    defaultValues: {
      status: 'active',
      members: [],
    },
  });

  const selectedMembers = watch('members') || [];

  useEffect(() => {
    fetchMembers();
    if (id) {
      fetchCommittee();
    }
  }, [id]);

  const fetchCommittee = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await committeeService.getById(id);
      setValue('name', data.name);
      setValue('description', data.description || '');
      setValue('nameMl', data.nameMl || '');
      setValue('descriptionMl', data.descriptionMl || '');
      setValue('status', data.status || 'active');
      const term = data as any;
      setValue('termStartDate', term.termStartDate ? String(term.termStartDate).slice(0, 10) : '');
      setValue('termEndDate', term.termEndDate ? String(term.termEndDate).slice(0, 10) : '');
      setValue('maxTermYears', (term.maxTermYears ?? '') as any);
      if (Array.isArray(data.members)) {
        const memberIds = data.members.map((m: any) => (typeof m === 'string' ? m : m.id));
        setValue('members', memberIds);
      }
    } catch (err: any) {
      setError(loadErrorMessage(err, 'committee'));
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    try {
      setLoadingMembers(true);
      const result = await memberService.getAll();
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
      setValue(
        'members',
        current.filter((id) => id !== memberId)
      );
    } else {
      setValue('members', [...current, memberId]);
    }
  };

  const filteredMembers = memberSearch
    ? members.filter((member) => {
        const query = memberSearch.toLowerCase();
        return member.name.toLowerCase().includes(query) || member.familyName.toLowerCase().includes(query);
      })
    : members;

  const onSubmit = async (data: CommitteeFormData) => {
    if (!id) return;
    try {
      setError(null);
      await committeeService.update(id, {
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
      navigate(ROUTES.COMMITTEES.LIST);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'update committee. please try again' }));
      console.error('Error updating committee:', err);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Edit Committee"
        description="Update committee information"
        breadcrumbs={[{ label: 'Committees', path: ROUTES.COMMITTEES.LIST }]}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Members ({selectedMembers.length} selected)
            </label>
            {loadingMembers ? (
              <p className="text-sm text-gray-500">Loading members...</p>
            ) : (
              <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 max-h-64 overflow-y-auto">
                <div className="mb-3">
                  <Input
                    label="Search Members"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                    placeholder="Search by member or family name"
                  />
                </div>
                {filteredMembers.length === 0 ? (
                  <p className="text-sm text-gray-500">No members available</p>
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
                          {toTitleCase(member.name)} ({toTitleCase(member.familyName)})
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="pt-4">
            <h3 className="text-sm font-semibold text-foreground">Term</h3>
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

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.COMMITTEES.LIST)}>
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-4 w-4 mr-2" />
              Update Committee
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
