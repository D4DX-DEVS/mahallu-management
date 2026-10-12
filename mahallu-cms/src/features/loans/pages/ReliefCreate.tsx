import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import PageHeader from '@/components/ui/PageHeader';
import { toast } from '@/store/toastStore';
import { reliefService, RELIEF_URGENCY_OPTIONS } from '@/services/qardService';
import { familyService } from '@/services/familyService';
import { getFriendlyError } from '@/utils/apiMessages';

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
      toast.success('Case reported');
      navigate(`/relief/${created.id}`);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't report the case. Try again in a moment."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Report an Emergency Case"
        description="Recorded as reported; verification and assistance follow"
      />

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <Card>
            <div className="mb-3.5">
              <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Case details</h2>
              <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Who needs help and how urgent it is</p>
            </div>
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
                  value: family.id,
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
          </Card>

          <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none border-t border-line bg-white/90 px-4 py-3 backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button type="button" variant="secondary" onClick={() => navigate('/relief')}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Report Case'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
