import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { welfareService, WelfareScheme } from '@/services/welfareService';
import { familyService } from '@/services/familyService';
import { toast } from '@/store/toastStore';

export default function ApplicationCreate() {
  const navigate = useNavigate();
  const [schemes, setSchemes] = useState<WelfareScheme[]>([]);
  const [families, setFamilies] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState({
    schemeId: '',
    familyId: '',
    requestedAmount: '',
    priority: 'medium',
    reason: '',
  });

  useEffect(() => {
    welfareService
      .getSchemes({ page: 1, limit: 100, status: 'active' })
      .then((result) => setSchemes(result.data))
      .catch(() => setSchemes([]));
    familyService
      .getAll({ page: 1, limit: 200 })
      .then((result) => setFamilies(result.data))
      .catch(() => setFamilies([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!form.schemeId) {
      newErrors.schemeId = 'Scheme is required';
    }
    if (!form.requestedAmount) {
      newErrors.requestedAmount = 'Requested amount is required';
    }
    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }
    try {
      setSaving(true);
      const application = await welfareService.createApplication({
        schemeId: form.schemeId,
        familyId: form.familyId || undefined,
        requestedAmount: Number(form.requestedAmount),
        priority: form.priority,
        reason: form.reason,
      });
      toast.success('Application created');
      navigate(`/welfare/applications/${application.id}`);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create application');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">New Welfare Application</h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Applications always start as pending and move through verification
          </p>
        </div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Welfare', path: '/welfare/applications' },
            { label: 'New' },
          ]}
        />
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Select
                label="Scheme"
                value={form.schemeId}
                onChange={(e) => {
                  setForm({ ...form, schemeId: e.target.value });
                  if (fieldErrors.schemeId) {
                    setFieldErrors({ ...fieldErrors, schemeId: '' });
                  }
                }}
                options={[
                  { value: '', label: 'Select a scheme' },
                  ...schemes.map((scheme) => ({ value: scheme.id, label: scheme.name })),
                ]}
                required
              />
              {fieldErrors.schemeId && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.schemeId}</p>}
            </div>

            <SearchableSelect
              label="Family"
              value={form.familyId}
              onChange={(value) => setForm({ ...form, familyId: value })}
              options={families.map((family: any) => ({
                value: family._id || family.id,
                label: `${family.houseName}${family.familyHead ? ` - ${family.familyHead}` : ''}`,
              }))}
              placeholder="Search family..."
            />

            <div>
              <Input
                label="Requested Amount"
                type="number"
                value={form.requestedAmount}
                onChange={(e) => {
                  setForm({ ...form, requestedAmount: e.target.value });
                  if (fieldErrors.requestedAmount) {
                    setFieldErrors({ ...fieldErrors, requestedAmount: '' });
                  }
                }}
                required
              />
              {fieldErrors.requestedAmount && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.requestedAmount}</p>}
            </div>

            <Select
              label="Priority"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
                { value: 'urgent', label: 'Urgent' },
              ]}
            />

            <div className="md:col-span-2">
              <Input
                label="Reason"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Why is this assistance needed?"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => navigate('/welfare/applications')}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Create Application'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
