import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { toast } from '@/store/toastStore';
import { reliefService, RELIEF_URGENCY_OPTIONS } from '@/services/qardService';
import { familyService } from '@/services/familyService';

export default function ReliefCreate() {
  const navigate = useNavigate();
  const [families, setFamilies] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    familyId: '',
    title: '',
    titleMl: '',
    description: '',
    urgency: 'medium',
    followUpDate: '',
  });

  useEffect(() => {
    familyService
      .getAll({ page: 1, limit: 200 } as any)
      .then((result: any) => setFamilies(result.data || []))
      .catch(() => setFamilies([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.title.trim()) {
      setError('Give the case a short title');
      return;
    }

    try {
      setSaving(true);
      const created = await reliefService.createCase({
        familyId: form.familyId || undefined,
        title: form.title,
        titleMl: form.titleMl || undefined,
        description: form.description || undefined,
        urgency: form.urgency,
        followUpDate: form.followUpDate || undefined,
      });
      toast.success('Case reported successfully');
      navigate(`/relief/${created.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to report the case');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Report an Emergency Case
          </h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Recorded as reported; verification and assistance follow
          </p>
        </div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Emergency Relief', path: '/relief' },
            { label: 'New' },
          ]}
        />
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Roof collapsed after heavy rain"
              required
            />

            <Input
              label="Title (Malayalam)"
              value={form.titleMl}
              onChange={(e) => setForm({ ...form, titleMl: e.target.value })}
              placeholder="Optional"
            />

            <SearchableSelect
              label="Family"
              value={form.familyId}
              onChange={(value) => setForm({ ...form, familyId: value })}
              options={families.map((family: any) => ({
                value: family._id || family.id,
                label: `${family.houseName}${family.mahallId ? ` - ${family.mahallId}` : ''}`,
              }))}
              placeholder="Search families..."
              helperText="Optional, but helps link the case to a household"
            />

            <Select
              label="Urgency"
              value={form.urgency}
              onChange={(e) => setForm({ ...form, urgency: e.target.value })}
              options={RELIEF_URGENCY_OPTIONS}
              required
            />

            <Input
              label="Follow-up date"
              type="date"
              value={form.followUpDate}
              onChange={(e) => setForm({ ...form, followUpDate: e.target.value })}
            />

            <div className="md:col-span-2">
              <Input
                label="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What happened, and what is needed"
              />
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => navigate('/relief')}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Report Case'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
