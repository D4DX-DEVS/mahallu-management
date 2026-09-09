import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import QuickAddCommittee from '@/components/quick-add/QuickAddCommittee';
import { ROUTES } from '@/constants/routes';
import { committeeService } from '@/services/committeeService';
import { meetingService } from '@/services/meetingService';
import { Committee, Member } from '@/types';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const meetingSchema = z.object({
  committeeId: z.string().max(200, 'Please keep the committee to 200 characters or less.').min(1, 'Committee is required'),
  title: z.string().max(200, 'Please keep the title to 200 characters or less.').min(1, 'Meeting title is required'),
  titleMl: z.string().max(200, 'Please keep the title to 200 characters or less.').optional(),
  meetingDate: z.string().max(200, 'Please keep the meeting date to 200 characters or less.').min(1, 'Meeting date is required'),
  agenda: z.string().max(3000, 'Please keep the agenda to 3000 characters or less.').optional(),
  agendaMl: z.string().max(3000, 'Please keep the agenda to 3000 characters or less.').optional(),
  attendance: z.array(z.string()).max(500, 'Please mark 500 attendees or fewer.').optional(),
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
      setValue(
        'attendance',
        selectedAttendance.filter((id) => id !== memberId)
      );
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
      setError(errorMessage(err, { action: 'create meeting. please try again' }));
      console.error('Error creating meeting:', err);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Create Meeting"
        description="Schedule a new committee meeting"
        breadcrumbs={[{ label: 'Meetings', path: ROUTES.COMMITTEES.MEETINGS }]}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
              {error}
            </div>
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
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Attendance ({selectedAttendance.length} selected)
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
                          checked={selectedAttendance.includes(member.id)}
                          onChange={() => toggleAttendance(member.id)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                          {member.name} ({member.familyName})
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.COMMITTEES.MEETINGS)}>
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-4 w-4 mr-2" />
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
