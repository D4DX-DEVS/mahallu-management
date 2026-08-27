import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Checkbox from '@/components/ui/Checkbox';
import { toast } from '@/store/toastStore';
import {
  announcementService,
  ANNOUNCEMENT_CATEGORY_OPTIONS,
  ANNOUNCEMENT_AUDIENCE_OPTIONS,
  ANNOUNCEMENT_CHANNELS,
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
      toast.error('Title and message are required');
      return;
    }
    try {
      setSaving(true);
      const created = await announcementService.create(form as any);
      if (sendNow) {
        await announcementService.send(created.id);
        toast.success('Announcement sent');
      } else {
        toast.success('Announcement saved as draft');
      }
      navigate(`/announcements/${created.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save announcement');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">New Announcement</h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Save as a draft, or publish straight away
          </p>
        </div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Announcements', path: '/announcements' },
            { label: 'New' },
          ]}
        />
      </div>

      <form onSubmit={(e) => handleSubmit(e, false)}>
        <Card className="p-3 sm:p-4">
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
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                Message
              </label>
              <textarea
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={5}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
              />
            </div>
          </div>

          <div className="mt-4">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Channels</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ANNOUNCEMENT_CHANNELS.map((channel) => (
                <label
                  key={channel.value}
                  className="flex items-center gap-2 rounded-xl border border-gray-200 px-2.5 py-2 dark:border-gray-700"
                >
                  <Checkbox
                    checked={form.channels.includes(channel.value)}
                    onChange={() => toggleChannel(channel.value)}
                  />
                  <span className="min-w-0 text-xs sm:text-sm">
                    <span className="block font-medium">{channel.label}</span>
                    {!channel.supported && <span className="block text-gray-400">not configured</span>}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => navigate('/announcements')}>
              Cancel
            </Button>
            <Button type="submit" variant="outline" disabled={saving}>
              Save Draft
            </Button>
            <Button type="button" onClick={(e: any) => handleSubmit(e, true)} disabled={saving}>
              {saving ? 'Working...' : 'Save & Send'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
