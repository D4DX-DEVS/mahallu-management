import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiTrash2 } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Modal from '@/components/ui/Modal';
import { meetingService } from '@/services/meetingService';
import { Meeting } from '@/types';
import { formatDateTime } from '@/utils/format';
import { ROUTES } from '@/constants/routes';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

export default function MeetingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      <div className="text-center py-10">
        <p className="text-red-600 dark:text-red-400">{error || 'Meeting not found'}</p>
        <Button onClick={() => navigate(ROUTES.COMMITTEES.MEETINGS)} className="mt-4" variant="outline">
          Back to Meetings
        </Button>
      </div>
    );
  }

  const handleDelete = async () => {
    if (!id) return;
    try {
      setDeleting(true);
      await meetingService.delete(id);
      navigate(ROUTES.COMMITTEES.MEETINGS);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'delete meeting' }));
      setDeleting(false);
    }
  };

  const attendanceNames = Array.isArray(meeting.attendance)
    ? meeting.attendance.map((m: any) => toTitleCase(m.name)).join(', ')
    : '-';

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center justify-between">
        <div className="flex items-center gap-4">
          <PageHeader
            title={toTitleCase(meeting.title)}
            description="Meeting Details"
            breadcrumbs={[{ label: 'Meetings', path: ROUTES.COMMITTEES.MEETINGS }]}
          />
          <div className="flex gap-2 items-center">
            <Button variant="danger" onClick={() => setShowDeleteModal(true)} icon={<FiTrash2 />} collapseLabel>
              Delete
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <div className="space-y-4">
          <div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Committee</span>
            <p className="text-gray-900 dark:text-gray-100">
              {toTitleCase(meeting.committeeName || (meeting.committeeId as any)?.name) || '-'}
            </p>
          </div>
          {(meeting as any).titleMl && (
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Title (Malayalam)</span>
              <p className="text-gray-900 dark:text-gray-100 font-malayalam">{(meeting as any).titleMl}</p>
            </div>
          )}
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
          {(meeting as any).agendaMl && (
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Agenda (Malayalam)</span>
              <p className="text-gray-900 dark:text-gray-100 font-malayalam">{(meeting as any).agendaMl}</p>
            </div>
          )}
          {(meeting as any).minutes && (
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Minutes</span>
              <p className="text-gray-900 dark:text-gray-100">{(meeting as any).minutes}</p>
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

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Meeting"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          Are you sure you want to delete <strong>{toTitleCase(meeting.title)}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
