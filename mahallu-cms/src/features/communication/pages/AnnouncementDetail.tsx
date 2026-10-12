import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { announcementService, Announcement } from '@/services/announcementService';
import { useUndoableAction } from '@/hooks/useUndoableAction';
import DeliveryStatusPanel from '../components/DeliveryStatusPanel';

const formatDate = (value?: string) => (value ? new Date(value).toLocaleString() : '-');

export default function AnnouncementDetail() {
  const undo = useUndoableAction('announcement');
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
      toast.success(updated.deliveryMessage || 'Announcement sent');
      setConfirmSend(false);
    } catch (err: any) {
      // A 422 still carries the announcement with its per-channel result: show it.
      if (err.response?.data?.data) setAnnouncement(err.response.data.data);
      toast.error(getFriendlyError(err, "Couldn't send announcement. Try again in a moment."));
      setConfirmSend(false);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setConfirmDelete(false);
    // Deferred: the list hides it right away, the API call waits out the undo window
    undo.run({
      id,
      label: `${announcement?.title || 'Announcement'} deleted`,
      commit: () => announcementService.remove(id),
      errorMessage: "Couldn't delete the announcement. Try again in a moment.",
    });
    navigate('/announcements');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!announcement) {
    return (
      <Card>
        <EmptyState title="Announcement not found" description="It may have been deleted." />
        <div className="pb-6 text-center">
          <Link to="/announcements">
            <Button variant="secondary">Back to announcements</Button>
          </Link>
        </div>
      </Card>
    );
  }

  const infoCards = [
    { label: 'Category', value: announcement.category },
    { label: 'Audience', value: announcement.audience },
    { label: 'Status', value: announcement.status },
    { label: 'Sent At', value: announcement.sentAt ? formatDate(announcement.sentAt) : '-' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title={announcement.title}
        description={
          announcement.titleMl ? <span className="font-malayalam">{announcement.titleMl}</span> : undefined
        }
        actions={
          <>
            <Button variant="danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
            {announcement.status === 'draft' && (
              <Button onClick={() => setConfirmSend(true)} disabled={sending}>
                {sending ? 'Sending...' : 'Send Now'}
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {infoCards.map((card) => (
          <Card key={card.label} padding="none" className="px-3.5 py-3">
            <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">{card.label}</p>
            <div className="mt-1 break-words text-[13px] font-semibold capitalize text-[#18231E] dark:text-surface-text">
              {card.label === 'Status' ? <StatusBadge status={announcement.status === 'sent' ? 'completed' : announcement.status} label={String(card.value).charAt(0).toUpperCase() + String(card.value).slice(1)} /> : card.value}
            </div>
          </Card>
        ))}
      </div>

      <Card padding="lg">
        <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Message</h2>
        <p className="mt-1.5 whitespace-pre-wrap text-[13px] text-[#3A4741] dark:text-surface-text/80">
          {announcement.body}
        </p>
      </Card>

      <DeliveryStatusPanel announcement={announcement} />

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
        isOpen={confirmDelete}
        title="Delete announcement?"
        message="Delete this announcement? This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
