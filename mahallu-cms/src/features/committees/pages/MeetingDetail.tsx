import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { meetingService } from '@/services/meetingService';
import { Meeting } from '@/types';
import { formatDateTime } from '@/utils/format';
import { ROUTES } from '@/constants/routes';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

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
        setError(loadErrorMessage(err, 'meeting'));
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchMeeting();
  }, [id]);

  if (loading) {
    return <PageSkeleton />;
  }

  if (error || !meeting) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">{error || 'Meeting not found'}</p>
        <Button onClick={() => navigate(ROUTES.COMMITTEES.MEETINGS)} className="mt-4" variant="outline">
          Back to Meetings
        </Button>
      </div>
    );
  }

  const attendanceNames = Array.isArray(meeting.attendance)
    ? meeting.attendance.map((m: any) => m.name).join(', ')
    : '-';

  return (
    <div className="space-y-6">
      <PageHeader
        title={meeting.title}
        description="Meeting Details"
        breadcrumbs={[{ label: 'Meetings', path: ROUTES.COMMITTEES.MEETINGS }]}
      />

      <Card>
        <div className="space-y-4">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Committee</span>
            <p className="text-gray-900 dark:text-gray-100">
              {meeting.committeeName || (meeting.committeeId as any)?.name || '-'}
            </p>
          </div>
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Date & Time</span>
            <p className="text-gray-900 dark:text-gray-100">{formatDateTime(meeting.meetingDate)}</p>
          </div>
          {meeting.agenda && (
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Agenda</span>
              <p className="text-gray-900 dark:text-gray-100">{meeting.agenda}</p>
            </div>
          )}
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Attendance</span>
            <p className="text-gray-900 dark:text-gray-100">{attendanceNames}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
            <p className="text-gray-900 dark:text-gray-100 capitalize">{meeting.status || 'scheduled'}</p>
          </div>
        </div>
      </Card>

      <Button variant="outline" onClick={() => navigate(ROUTES.COMMITTEES.MEETINGS)}>
        <FiArrowLeft className="h-4 w-4 mr-2" />
        Back to Meetings
      </Button>
    </div>
  );
}
