import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { meetingService } from '@/services/meetingService';
import { Meeting } from '@/types';
import { formatDateTime } from '@/utils/format';
import { ROUTES } from '@/constants/routes';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/ui/PageHeader';
import Avatar from '@/components/ui/Avatar';
import { getFriendlyError } from '@/utils/apiMessages';

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMeeting = async () => {
      try {
        setLoading(true);
        const data = await meetingService.getById(id!);
        setMeeting(data);
      } catch (err: any) {
        setError(getFriendlyError(err, "Couldn't load meeting. Refresh the page or try again."));
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchMeeting();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">{error || 'Meeting not found'}</p>
        <Button onClick={() => navigate(ROUTES.COMMITTEES.MEETINGS)} className="mt-4" variant="secondary">
          Back to Meetings
        </Button>
      </div>
    );
  }

  const attendanceNames = Array.isArray(meeting.attendance)
    ? meeting.attendance.map((m: any) => m.name).join(', ')
    : '-';

  return (
    <div className="space-y-4">
      <PageHeader
        leading={<Avatar size={56} name={meeting.title} />}
        title={meeting.title}
        description="Meeting Details"
        actions={
          <Button variant="secondary" onClick={() => navigate(ROUTES.COMMITTEES.MEETINGS)}>
            <FiArrowLeft className="h-3.5 w-3.5" />
            Back to Meetings
          </Button>
        }
      />

      <Card>
        <div className="space-y-4">
          <div>
            <span className="text-sm text-[#7B8983] dark:text-surface-muted">Committee</span>
            <p className="text-[#18231E] dark:text-surface-text">{meeting.committeeName || (meeting.committeeId as any)?.name || '-'}</p>
          </div>
          <div>
            <span className="text-sm text-[#7B8983] dark:text-surface-muted">Date & Time</span>
            <p className="text-[#18231E] dark:text-surface-text">{formatDateTime(meeting.meetingDate)}</p>
          </div>
          {meeting.agenda && (
            <div>
              <span className="text-sm text-[#7B8983] dark:text-surface-muted">Agenda</span>
              <p className="text-[#18231E] dark:text-surface-text">{meeting.agenda}</p>
            </div>
          )}
          <div>
            <span className="text-sm text-[#7B8983] dark:text-surface-muted">Attendance</span>
            {Array.isArray(meeting.attendance) && meeting.attendance.length > 0 ? (
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-2">
                {meeting.attendance.map((m: any, i: number) => (
                  <li key={m.id || i} className="flex items-center gap-2 text-[#18231E] dark:text-surface-text">
                    <Avatar size={24} name={m.name} src={m.photoUrl} />
                    {m.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[#18231E] dark:text-surface-text">{attendanceNames}</p>
            )}
          </div>
          <div>
            <span className="text-sm text-[#7B8983] dark:text-surface-muted">Status</span>
            <div className="mt-0.5">
              <StatusBadge status={meeting.status || 'scheduled'} />
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
