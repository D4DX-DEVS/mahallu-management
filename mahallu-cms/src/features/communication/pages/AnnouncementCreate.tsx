import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { clusterService } from '@/services/clusterService';
import { fetchAllPages } from '@/services/api';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { useFormValidation } from '@/hooks/useFormValidation';
import { FieldRule, LIMITS } from '@/utils/validation';

/** Matches the API's announcement rules, including the 5,000-character body. */
const RULES: Record<string, FieldRule> = {
  title: { label: 'title', required: true, minLength: 2, maxLength: LIMITS.title.max },
  titleMl: { label: 'title', maxLength: LIMITS.title.max },
  body: { label: 'message', required: true, maxLength: LIMITS.longText.max },
  category: { label: 'category', maxLength: LIMITS.shortText.max },
  audience: { label: 'audience', maxLength: LIMITS.shortText.max },
};

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
  const [clusterId, setClusterId] = useState('');
  const [clusterOptions, setClusterOptions] = useState<{ value: string; label: string }[]>([]);
  const { errors, validate } = useFormValidation(RULES);

  // Without a cluster selected, the WhatsApp fan-out drops the cluster
  // filter entirely and broadcasts to every family in the tenant instead of
  // the chosen cluster — so the picker must be populated before send.
  useEffect(() => {
    if (form.audience !== 'cluster' || clusterOptions.length > 0) return;
    fetchAllPages(({ page, limit }) => clusterService.getAll({ page, limit, status: 'active' }))
      .then((clusters) => setClusterOptions(clusters.map((c) => ({ value: c.id, label: c.name }))))
      .catch(() => setClusterOptions([]));
  }, [form.audience, clusterOptions.length]);

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
    // Length and shape as well as presence - the body reaches push, WhatsApp
    // and SMS, and the API caps it at 5,000 characters.
    if (!validate(form)) return;
    if (form.audience === 'cluster' && !clusterId) {
      toast.error('Please choose a cluster to target.');
      return;
    }
    if (saving) return;
    try {
      setSaving(true);
      const payload: any = { ...form };
      if (form.audience === 'cluster') payload.audienceRefIds = [clusterId];
      const created = await announcementService.create(payload);
      if (sendNow) {
        await announcementService.send(created.id);
        toast.success('Announcement sent');
      } else {
        toast.success('Announcement saved as draft');
      }
      navigate(`/announcements/${created.id}`);
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'save announcement' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <PageHeader
        title="New Announcement"
        description="Save as a draft, or publish straight away"
        breadcrumbs={[{ label: 'Announcements', path: '/announcements' }]}
      />

      <form onSubmit={(e) => handleSubmit(e, false)}>
        <Card>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Title"
              value={form.title}
              error={errors.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <Input
              label="Title (Malayalam)"
              value={form.titleMl}
              error={errors.titleMl}
              onChange={(e) => setForm({ ...form, titleMl: e.target.value })}
              className="font-malayalam"
            />
            <Select
              label="Category"
              value={form.category}
              error={errors.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              options={ANNOUNCEMENT_CATEGORY_OPTIONS}
            />
            <Select
              label="Audience"
              value={form.audience}
              error={errors.audience}
              onChange={(e) => {
                setForm({ ...form, audience: e.target.value });
                setClusterId('');
              }}
              options={ANNOUNCEMENT_AUDIENCE_OPTIONS}
            />
            {form.audience === 'cluster' && (
              <Select
                label="Cluster"
                value={clusterId}
                onChange={(e) => setClusterId(e.target.value)}
                options={clusterOptions}
                placeholder="Select a cluster"
                required
              />
            )}
            <div className="md:col-span-2">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                Message
              </label>
              <textarea
                aria-label="Message"
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
