import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { announcementService, Announcement } from '@/services/announcementService';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const formatDate = (value?: string) => (value ? new Date(value).toLocaleString() : '-');

export default function AnnouncementDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [confirmSend, setConfirmSend] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!id) return;
    announcementService
      .getById(id)
      .then(setAnnouncement)
      .catch(() => setAnnouncement(null))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSend = async () => {
    if (!id) return;
    try {
      setSending(true);
      const updated = await announcementService.send(id);
      setAnnouncement(updated);
      toast.success('Announcement sent');
      setConfirmSend(false);
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'send announcement' }));
      setConfirmSend(false);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await announcementService.remove(id);
      toast.success('Announcement deleted');
      navigate('/announcements');
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete announcement' }));
      setConfirmDelete(false);
    }
  };

  if (loading) {
    return <PageSkeleton variant="section" />;
  }

  if (!announcement) {
    return (
      <Card>
        <p className="text-red-600 dark:text-red-400">Announcement not found</p>
        <Link to="/announcements">
          <Button variant="outline" className="mt-4">
            Back to announcements
          </Button>
        </Link>
      </Card>
    );
  }

  const infoCards = [
    { label: 'Category', value: announcement.category },
    { label: 'Audience', value: announcement.audience },
    { label: 'Status', value: announcement.status },
    { label: 'Sent At', value: announcement.sentAt ? formatDate(announcement.sentAt) : '-' },
  ];

  const deliveryRows = Object.entries(announcement.deliveryResults || {});

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {announcement.titleMl && (
            <p className="mt-0.5 font-malayalam text-xs text-gray-500 dark:text-gray-400">
              {announcement.titleMl}
            </p>
          )}
        </div>
        <PageHeader
          title={announcement.title}
          breadcrumbs={[{ label: 'Announcements', path: '/announcements' }]}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {infoCards.map((card) => (
          <Card key={card.label}>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 sm:text-sm">{card.label}</p>
            <p className="mt-1 break-words text-sm font-semibold text-gray-900 dark:text-gray-100 sm:text-base">
              {card.value}
            </p>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Message</h2>
        <p className="mt-1 whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">
          {announcement.body}
        </p>
      </Card>

      <Card>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Channels</h2>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {announcement.channels.map((channel) => (
            <div
              key={channel}
              className="rounded-xl border border-gray-200 px-2.5 py-2 text-xs dark:border-gray-700 sm:text-sm"
            >
              <span className="block font-medium capitalize">{channel}</span>
              <span className="block text-gray-500 dark:text-gray-400">
                {deliveryRows.find(([key]) => key === channel)?.[1] || 'not sent'}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => setConfirmDelete(true)}>
          Delete
        </Button>
        {announcement.status === 'draft' && (
          <Button onClick={() => setConfirmSend(true)} disabled={sending}>
            {sending ? 'Sending...' : 'Send Now'}
          </Button>
        )}
      </div>

      <ConfirmDialog
        isOpen={confirmSend}
        title="Send Announcement"
        message="Send this announcement now to all recipients?"
        confirmLabel="Send"
        cancelLabel="Cancel"
        isLoading={sending}
        onConfirm={handleSend}
        onCancel={() => setConfirmSend(false)}
      />

      <ConfirmDialog
        isLoading={loading}
        isOpen={confirmDelete}
        title="Delete Announcement"
        message="Delete this announcement? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
