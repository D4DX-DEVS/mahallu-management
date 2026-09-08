import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { PageSkeleton } from '@/components/ui/Skeleton';
import QuickAddMember from '@/components/quick-add/QuickAddMember';
import { toast } from '@/store/toastStore';
import { zakatDistributionService, PRIORITY_AREA_OPTIONS } from '@/services/zakatDistributionService';
import { memberService } from '@/services/memberService';
import { useCategoryOptions } from '@/hooks/useCategoryOptions';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
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

export default function BeneficiaryEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { options: zakatCategoryOptions } = useCategoryOptions('zakat_asnaf_category');

  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
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

    if (id) {
      fetchBeneficiary(id);
    }
  }, [id]);

  const fetchBeneficiary = async (beneficiaryId: string) => {
    try {
      setLoading(true);
      const { beneficiary } = await zakatDistributionService.getBeneficiary(beneficiaryId);
      const rawMemberId = beneficiary.memberId;
      const memberId: string =
        typeof rawMemberId === 'object' && rawMemberId ? rawMemberId.id : (rawMemberId as string) || '';
      setForm({
        memberId,
        name: beneficiary.name || '',
        category: beneficiary.category || 'miskin',
        priorityArea: beneficiary.priorityArea || '',
        notes: beneficiary.notes || '',
      });
    } catch (err: any) {
      toast.error(loadErrorMessage(err, 'this beneficiary'));
      navigate('/zakat/beneficiaries');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Every field checked at once, each message on its own field.
    if (!validate(form)) return;
    if (!id) return;

    try {
      setSaving(true);
      await zakatDistributionService.updateBeneficiary(id, {
        memberId: form.memberId || undefined,
        name: form.name || undefined,
        category: form.category,
        priorityArea: form.priorityArea || undefined,
        notes: form.notes || undefined,
      });
      toast.success('Beneficiary saved');
      navigate('/zakat/beneficiaries');
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'save this beneficiary' }));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div>
      <PageHeader
        title="Edit beneficiary"
        description="Verification status is managed separately from the beneficiaries list."
        breadcrumbs={[{ label: 'Zakat', path: '/zakat/beneficiaries' }]}
      />

      <form onSubmit={handleSubmit}>
        <Card padding="lg">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <SearchableSelect
                  label="Member"
                  value={form.memberId}
                  error={errors.memberId}
                  onChange={(value) => setForm({ ...form, memberId: value })}
                  options={members.map((member: any) => ({
                    value: member._id || member.id,
                    label: `${member.name}${member.familyName ? ` · ${member.familyName}` : ''}`,
                  }))}
                  placeholder="Search zakat-eligible members"
                  helperText="Leave blank for a non-member beneficiary"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setAddMemberOpen(true)}
                aria-label="Add a new member"
              >
                <FiPlus className="h-4 w-4" />
              </Button>
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
              options={zakatCategoryOptions}
              required
            />

            <Select
              label="Priority area"
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

          <div className="mt-6 flex flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => navigate('/zakat/beneficiaries')}>
              Cancel
            </Button>
            <Button type="submit" isLoading={saving} loadingText="Saving">
              Save changes
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
