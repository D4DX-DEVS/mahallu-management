import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import QuickAddMember from '@/components/quick-add/QuickAddMember';
import { toast } from '@/store/toastStore';
import {
  zakatDistributionService,
  ZAKAT_CATEGORY_OPTIONS,
  PRIORITY_AREA_OPTIONS,
} from '@/services/zakatDistributionService';
import { memberService } from '@/services/memberService';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { useFormValidation } from '@/hooks/useFormValidation';
import { FieldRule, LIMITS } from '@/utils/validation';

/**
 * The same limits the API applies, so a form that passes here is not
 * refused there. Required matches what each input already declares.
 */
const RULES: Record<string, FieldRule> = {
  memberId: { label: 'member', type: 'id' },
  name: {
    label: 'name',
    maxLength: LIMITS.title.max,
    custom: (value, values) =>
      !value && !values.memberId ? 'Please choose a member, or enter a name.' : undefined,
  },
  category: { label: 'category', required: true, maxLength: LIMITS.shortText.max },
  priorityArea: { label: 'priority area', maxLength: LIMITS.shortText.max },
  notes: { label: 'notes', maxLength: LIMITS.notes.max },
};

export default function BeneficiaryCreate() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [form, setForm] = useState({
    memberId: '',
    name: '',
    category: 'miskin',
    priorityArea: '',
    notes: '',
  });
  const { errors, validate, setErrors } = useFormValidation(RULES);

  useEffect(() => {
    // Candidates first: members already flagged as zakat-eligible in the register
    memberService
      .getAll({ page: 1, limit: 200, isZakatEligible: true } as any)
      .then((result: any) => setMembers(result.data || []))
      .catch(() => setMembers([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Every field checked at once, each message on its own field.
    if (!validate(form)) return;
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
      toast.error(errorMessage(err, { action: 'create beneficiary' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <PageHeader
        title="New Zakat Beneficiary"
        description="Registered as pending; verify before recording any distribution"
        breadcrumbs={[{ label: 'Zakat', path: '/zakat/beneficiaries' }]}
      />

      <form onSubmit={handleSubmit}>
        <Card>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <SearchableSelect
                    label="Member"
                    value={form.memberId}
                    error={errors.memberId}
                    onChange={(value) => setForm({ ...form, memberId: value })}
                    options={members.map((member: any) => ({
                      value: member._id || member.id,
                      label: `${member.name}${member.familyName ? ` - ${member.familyName}` : ''}`,
                    }))}
                    placeholder="Search zakat-eligible members..."
                    helperText="Leave blank for a non-member beneficiary"
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
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
              error={errors.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                if (errors.name) setErrors({ ...errors, name: '' });
              }}
              placeholder="Required when no member is selected"
            />

            <Select
              label="Category"
              value={form.category}
              error={errors.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              options={ZAKAT_CATEGORY_OPTIONS}
              required
            />

            <Select
              label="Priority Area"
              value={form.priorityArea}
              error={errors.priorityArea}
              onChange={(e) => setForm({ ...form, priorityArea: e.target.value })}
              options={PRIORITY_AREA_OPTIONS}
            />

            <div className="md:col-span-2">
              <Input
                label="Notes"
                value={form.notes}
                error={errors.notes}
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
