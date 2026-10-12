import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Checkbox from '@/components/ui/Checkbox';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import {
  announcementService,
  ANNOUNCEMENT_CATEGORY_OPTIONS,
  ANNOUNCEMENT_AUDIENCE_OPTIONS,
  ANNOUNCEMENT_CHANNELS,
  ChannelAvailability,
} from '@/services/announcementService';

export default function AnnouncementCreate() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: '',
    titleMl: '',
    body: '',
    category: 'announcement',
    audience: 'all',
    channels: ['push'] as string[],
  });

  const [availability, setAvailability] = useState<Record<string, ChannelAvailability>>({});
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    announcementService.getChannels()
      .then(({ channels, testMode: t }) => {
        setAvailability(Object.fromEntries(channels.map((c) => [c.channel, c])));
        setTestMode(t);
      })
      .catch(() => setAvailability({}));
  }, []);

  const toggleChannel = (value: string) => {
    setForm((prev) => ({
      ...prev,
      channels: prev.channels.includes(value)
        ? prev.channels.filter((c) => c !== value)
        : [...prev.channels, value],
    }));
  };

  const handleSubmit = async (e: React.FormEvent, sendNow: boolean) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      toast.error('Add a title and a message to continue');
      return;
    }
    try {
      setSaving(true);
      const created = await announcementService.create(form as any);
      const createdId = created.id;
      if (sendNow) {
        try {
          const sent = await announcementService.send(createdId);
          toast.success(sent.deliveryMessage || 'Announcement sent');
        } catch (sendErr: any) {
          // Saved but nothing went out (for example no channel is set up): keep the draft and say why.
          toast.error(getFriendlyError(sendErr, 'Saved as a draft, but it could not be sent. Try again in a moment.'));
        }
      } else {
        toast.success('Announcement saved as draft');
      }
      navigate(`/announcements/${createdId}`);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't save announcement. Check the details and try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="New announcement" description="Save as a draft, or publish straight away" />

      <form onSubmit={(e) => handleSubmit(e, false)} className="space-y-4">
        <Card padding="lg">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Message</h2>
            <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Title, audience and the message body</p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <Input
              label="Title (Malayalam)"
              value={form.titleMl}
              onChange={(e) => setForm({ ...form, titleMl: e.target.value })}
              className="font-malayalam"
            />
            <Select
              label="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              options={ANNOUNCEMENT_CATEGORY_OPTIONS}
            />
            <Select
              label="Audience"
              value={form.audience}
              onChange={(e) => setForm({ ...form, audience: e.target.value })}
              options={ANNOUNCEMENT_AUDIENCE_OPTIONS}
            />
            <div className="md:col-span-2">
              <label className={labelClasses}>Message</label>
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={5}
                required
                className={`${controlClasses} py-2`}
              />
            </div>
          </div>
        </Card>

        <Card padding="lg">
          <div className="mb-3">
            <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Channels</h2>
            <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Where this announcement is delivered</p>
            {testMode && <p className="mt-1 text-xs font-semibold text-[#7A5B00]">Test mode is on: nothing is actually sent from this server.</p>}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ANNOUNCEMENT_CHANNELS.map((channel) => {
              const info = availability[channel.value];
              // Until the server answers, nothing is disabled; afterwards a channel that is not set up cannot be picked.
              const unavailable = info ? !info.available : !channel.supported;
              return (
                <label
                  key={channel.value}
                  className={`flex items-center gap-2 rounded-xl border border-line px-2.5 py-2 dark:border-surface-border ${unavailable ? 'opacity-60' : ''}`}
                  title={info?.reason || info?.reach}
                >
                  <Checkbox
                    checked={form.channels.includes(channel.value)}
                    disabled={unavailable}
                    onChange={() => toggleChannel(channel.value)}
                  />
                  <span className="min-w-0 text-xs">
                    <span className="block font-semibold text-[#18231E] dark:text-surface-text">{info?.label || channel.label}</span>
                    <span className="block text-[#7B8983] dark:text-surface-muted">
                      {unavailable ? (info?.reason || 'Not set up') : info?.reach || 'Available'}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </Card>

        <div className="sticky bottom-0 z-10 flex flex-col gap-2 border-t border-line bg-white/90 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur dark:border-surface-border dark:bg-surface-card/90 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => navigate('/announcements')}>
            Cancel
          </Button>
          <Button type="submit" variant="secondary" disabled={saving}>
            Save Draft
          </Button>
          <Button type="button" onClick={(e: any) => handleSubmit(e, true)} disabled={saving}>
            {saving ? 'Working...' : 'Save & Send'}
          </Button>
        </div>
      </form>
    </div>
  );
}
