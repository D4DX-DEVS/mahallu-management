import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import PageHeader from '@/components/ui/PageHeader';
import QuickAddMember from '@/components/quick-add/QuickAddMember';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
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
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
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
    const newErrors: Record<string, string> = {};

    if (!form.memberId && !form.name.trim()) {
      newErrors.name = 'Pick a member or enter a name';
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
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
      toast.success('Beneficiary registered');
      navigate('/zakat/beneficiaries');
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create beneficiary. Check the details and try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="New Zakat Beneficiary"
        description="Registered as pending; verify before recording any distribution"
      />

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <Card>
            <div className="mb-3.5">
              <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Beneficiary details</h2>
              <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Member or applicant details and zakat category</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <SearchableSelect
                      label="Member"
                      value={form.memberId}
                      onChange={(value) => setForm({ ...form, memberId: value })}
                      options={members.map((member: any) => ({
                        value: member.id,
                        label: `${member.name}${member.familyName ? ` - ${member.familyName}` : ''}`,
                      }))}
                      placeholder="Search zakat-eligible members..."
                      helperText="Leave blank for a non-member beneficiary"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setAddMemberOpen(true)}
                    title="Add a new member"
                  >
                    <FiPlus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Input
                label="Name (non-member)"
                value={form.name}
                onChange={(e) => {
                  setForm({ ...form, name: e.target.value });
                  if (errors.name) setErrors({ ...errors, name: '' });
                }}
                placeholder="Required when no member is selected"
                error={errors.name}
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
          </Card>

          <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none border-t border-line bg-white/90 px-4 py-3 backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button type="button" variant="secondary" onClick={() => navigate('/zakat/beneficiaries')}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Register Beneficiary'}
            </Button>
          </div>
        </div>
      </form>

      <QuickAddMember
        open={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        onCreated={(newMember) => {
          setMembers((prev) => [...prev, newMember]);
          setForm({ ...form, memberId: newMember.id });
        }}
      />
    </div>
  );
}
