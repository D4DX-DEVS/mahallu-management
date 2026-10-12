import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Alert from '@/components/ui/Alert';
import { announcementService, Announcement, DeliveryRow } from '@/services/announcementService';

const NAMES: Record<string, string> = { push: 'The app', whatsapp: 'WhatsApp', sms: 'SMS', email: 'Email' };
const STATUS_TONE: Record<string, 'success' | 'danger' | 'warning' | 'neutral'> = { sent: 'success', failed: 'danger', queued: 'warning', skipped: 'neutral' };

/** What happened on each channel for one announcement, with a drill-down into problem recipients. */
export default function DeliveryStatusPanel({ announcement }: { announcement: Announcement & { id?: string } }) {
  const id = announcement.id;
  const [open, setOpen] = useState<string | null>(null);
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const summary = announcement.deliverySummary || {};
  const channels = announcement.channels;
  const attempted = Object.keys(summary).length > 0;

  useEffect(() => {
    if (!open || !id) return;
    announcementService.getDeliveries(id, { channel: open, limit: 50 }).then((r) => setRows(r.rows)).catch(() => setRows([]));
  }, [open, id, announcement.sentAt, announcement.deliveryMessage]);

  return (
    <Card padding="lg">
      <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Delivery</h2>
      {announcement.deliveryMessage ? (
        <Alert tone={announcement.status === 'sent' ? 'info' : 'warning'} className="mt-2">{announcement.deliveryMessage}</Alert>
      ) : (
        <p className="mt-1 text-xs text-[#7B8983] dark:text-surface-muted">Not sent yet. Channels chosen: {channels.map((c) => NAMES[c] || c).join(', ')}.</p>
      )}

      {attempted && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {channels.map((c) => {
            const s = summary[c];
            if (!s) return null;
            const state = s.sent > 0 ? 'sent' : s.failed > 0 ? 'failed' : 'skipped';
            return (
              <button type="button" key={c} onClick={() => setOpen(open === c ? null : c)}
                className="rounded-xl border border-line px-3 py-2.5 text-left text-xs hover:bg-mint/40 dark:border-surface-border dark:hover:bg-surface-hover" aria-expanded={open === c}>
                <span className="flex items-center justify-between">
                  <span className="font-semibold text-[#18231E] dark:text-surface-text">{NAMES[c] || c}</span>
                  <Badge variant={STATUS_TONE[state]} dot>{state === 'skipped' ? 'Not sent' : state === 'failed' ? 'Failed' : 'Sent'}</Badge>
                </span>
                <span className="mt-1.5 block text-[#6A7771] dark:text-surface-muted">
                  {s.sent} sent{s.failed > 0 && <>, <b className="text-[#B3261E]">{s.failed} failed</b></>}{s.skipped > 0 && <>, {s.skipped} skipped</>}{s.queued > 0 && <>, {s.queued} queued</>}
                </span>
                {s.note && <span className="mt-1 block text-[12px] text-[#7B8983]">{s.note}</span>}
              </button>
            );
          })}
        </div>
      )}

      {open && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-line dark:border-surface-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#F4F7F5] text-[#6A7771] dark:bg-surface-raised"><tr><th className="px-3 py-2">Recipient</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Detail</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-line dark:border-surface-border">
                  <td className="px-3 py-1.5">{r.recipient}</td>
                  <td className="px-3 py-1.5"><Badge variant={STATUS_TONE[r.status]} size="sm">{r.status}</Badge></td>
                  <td className="px-3 py-1.5 text-[#6A7771]">{r.error || ''}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={3} className="px-3 py-3 text-[#7B8983]">Nothing recorded.</td></tr>}
            </tbody>
          </table>
          <p className="px-3 py-1.5 text-[12px] text-[#98A59F]">Phone numbers are partly hidden. Showing up to 50 recipients.</p>
        </div>
      )}
    </Card>
  );
}
