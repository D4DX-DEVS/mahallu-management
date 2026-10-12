import { useEffect, useState } from 'react';
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
import QuickAddCommittee from '@/components/quick-add/QuickAddCommittee';
import { ROUTES } from '@/constants/routes';
import { committeeService } from '@/services/committeeService';
import { meetingService } from '@/services/meetingService';
import { Committee, Member } from '@/types';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const meetingSchema = z.object({
  committeeId: z.string().min(1, 'Committee is required'),
  title: z.string().min(1, 'Meeting title is required'),
  titleMl: z.string().optional(),
  meetingDate: z.string().min(1, 'Meeting date is required'),
  agenda: z.string().optional(),
  agendaMl: z.string().optional(),
  attendance: z.array(z.string()).optional(),
});

type MeetingFormData = z.infer<typeof meetingSchema>;

export default function CreateMeeting() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [committeeMembers, setCommitteeMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [addCommitteeOpen, setAddCommitteeOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MeetingFormData>({
    resolver: zodResolver(meetingSchema),
    defaultValues: {
      meetingDate: new Date().toISOString().slice(0, 16),
      attendance: [],
    },
  });

  const selectedCommitteeId = watch('committeeId');
  const selectedAttendance = watch('attendance') || [];

  useEffect(() => {
    const fetchCommittees = async () => {
      try {
        const result = await committeeService.getAll({ limit: 1000 });
        setCommittees(result.data || []);
      } catch (err) {
        console.error('Error fetching committees:', err);
        setCommittees([]);
      }
    };
    fetchCommittees();
  }, []);

  useEffect(() => {
    const fetchCommitteeMembers = async () => {
      if (!selectedCommitteeId) {
        setCommitteeMembers([]);
        return;
      }
      try {
        setLoadingMembers(true);
        const committee = await committeeService.getById(selectedCommitteeId);
        setCommitteeMembers((committee.members as Member[]) || []);
      } catch (err) {
        console.error('Error fetching committee members:', err);
        setCommitteeMembers([]);
      } finally {
        setLoadingMembers(false);
      }
    };
    fetchCommitteeMembers();
  }, [selectedCommitteeId]);

  const toggleAttendance = (memberId: string) => {
    if (selectedAttendance.includes(memberId)) {
      setValue('attendance', selectedAttendance.filter((id) => id !== memberId));
    } else {
      setValue('attendance', [...selectedAttendance, memberId]);
    }
  };

  const filteredMembers = memberSearch
    ? committeeMembers.filter((member) => {
        const query = memberSearch.toLowerCase();
        return member.name.toLowerCase().includes(query) || member.familyName.toLowerCase().includes(query);
      })
    : committeeMembers;

  const onSubmit = async (data: MeetingFormData) => {
    try {
      setError(null);
      await meetingService.create({
        committeeId: data.committeeId,
        title: data.title,
        titleMl: data.titleMl,
        meetingDate: data.meetingDate,
        agenda: data.agenda,
        agendaMl: data.agendaMl,
        attendance: data.attendance || [],
        status: 'scheduled',
      });
      navigate(ROUTES.COMMITTEES.MEETINGS);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create meeting. Check the details and try again."));
      console.error('Error creating meeting:', err);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Create Meeting"
        description="Schedule a new committee meeting"
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-6">
          <div>
            <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">Meeting details</h2>
            <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Committee, date, agenda and attendance</p>
          </div>
          {error && (
            <Alert tone="danger">{error}</Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Committee"
              options={[
                { value: '', label: 'Select committee...' },
                ...committees.map((committee) => ({ value: committee.id, label: committee.name })),
              ]}
              value={watch('committeeId') || ''}
              onAddNew={() => setAddCommitteeOpen(true)}
              addNewLabel="Add Committee"
              {...register('committeeId')}
              error={errors.committeeId?.message}
              required
              className="md:col-span-2"
            />
            <Input
              label="Meeting Title"
              {...register('title')}
              error={errors.title?.message}
              required
              placeholder="Meeting Title"
              className="md:col-span-2"
            />
            <div className="hidden">
            <Input
              label="Meeting Title (Malayalam)"
              {...register('titleMl')}
              placeholder="യോഗ തലക്കെട്ട്"
              className="md:col-span-2 font-malayalam"
            />
            </div>
            <Input
              label="Meeting Date & Time"
              type="datetime-local"
              {...register('meetingDate')}
              error={errors.meetingDate?.message}
              required
            />
            <Input
              label="Agenda"
              {...register('agenda')}
              placeholder="Meeting agenda"
              className="md:col-span-2"
            />
            <div className="hidden">
            <Input
              label="Agenda (Malayalam)"
              {...register('agendaMl')}
              placeholder="അജണ്ട"
              className="md:col-span-2 font-malayalam"
            />
            </div>
          </div>

          <div className="md:col-span-2">
            <label className={labelClasses}>
              Attendance ({selectedAttendance.length} selected)
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
                          checked={selectedAttendance.includes(member.id)}
                          onChange={() => toggleAttendance(member.id)}
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

          <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none rounded-b-card border-t border-line bg-white/90 px-4 py-3 backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button type="button" variant="secondary" onClick={() => navigate(ROUTES.COMMITTEES.MEETINGS)}>
              <FiX className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-3.5 w-3.5" />
              Create Meeting
            </Button>
          </div>
        </Card>
      </form>

      <QuickAddCommittee
        open={addCommitteeOpen}
        onClose={() => setAddCommitteeOpen(false)}
        onCreated={(newCommittee) => {
          setCommittees((prev) => [...prev, { id: newCommittee.id, name: newCommittee.label } as Committee]);
          setValue('committeeId', newCommittee.id, { shouldValidate: true });
        }}
      />
    </div>
  );
}
