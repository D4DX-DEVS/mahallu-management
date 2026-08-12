import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import {
  zakatDistributionService,
  ZAKAT_CATEGORY_OPTIONS,
  PRIORITY_AREA_OPTIONS,
} from '@/services/zakatDistributionService';
import { memberService } from '@/services/memberService';

export default function BeneficiaryCreate() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    memberId: '',
    name: '',
    category: 'miskin',
    priorityArea: '',
    notes: '',
  });

  useEffect(() => {
    // Candidates first: members already flagged as zakat-eligible in the register
    memberService
      .getAll({ page: 1, limit: 200, isZakatEligible: true } as any)
      .then((result: any) => setMembers(result.data || []))
      .catch(() => setMembers([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.memberId && !form.name.trim()) {
      alert('Pick a member or enter a name');
      return;
    }
    try {
      setSaving(true);
      await zakatDistributionService.createBeneficiary({
        memberId: form.memberId || undefined,
        name: form.name || undefined,
        category: form.category,
        priorityArea: form.priorityArea || undefined,
        notes: form.notes || undefined,
      });
      navigate('/zakat/beneficiaries');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create beneficiary');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">New Zakat Beneficiary</h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Registered as pending; verify before recording any distribution
          </p>
        </div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Zakat', path: '/zakat/beneficiaries' },
            { label: 'New' },
          ]}
        />
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-3 sm:p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <SearchableSelect
              label="Member"
              value={form.memberId}
              onChange={(value) => setForm({ ...form, memberId: value })}
              options={members.map((member: any) => ({
                value: member._id || member.id,
                label: `${member.name}${member.familyName ? ` - ${member.familyName}` : ''}`,
              }))}
              placeholder="Search zakat-eligible members..."
              helperText="Leave blank for a non-member beneficiary"
            />

            <Input
              label="Name (non-member)"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Required when no member is selected"
            />

            <Select
              label="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              options={ZAKAT_CATEGORY_OPTIONS}
              required
            />

            <Select
              label="Priority Area"
              value={form.priorityArea}
              onChange={(e) => setForm({ ...form, priorityArea: e.target.value })}
              options={PRIORITY_AREA_OPTIONS}
            />

            <div className="md:col-span-2">
              <Input
                label="Notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => navigate('/zakat/beneficiaries')}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Register Beneficiary'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
