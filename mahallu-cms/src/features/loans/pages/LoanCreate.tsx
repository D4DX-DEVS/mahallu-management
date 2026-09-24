import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import QuickAddMember from '@/components/quick-add/QuickAddMember';
import { toast } from '@/store/toastStore';
import { qardService, LOAN_PURPOSE_OPTIONS } from '@/services/qardService';
import { memberService } from '@/services/memberService';
import { fetchAllPages } from '@/services/api';
import { Member } from '@/types';
import { FiPlus } from 'react-icons/fi';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { useFormValidation } from '@/hooks/useFormValidation';
import { FieldRule, LIMITS } from '@/utils/validation';
import { toTitleCase } from '@/utils/format';

/**
 * Same limits the API applies, so a form that passes here is not refused there.
 * A member or a name is required, but either will do - the pair is checked
 * together on the name, which is where the message belongs.
 */
const RULES: Record<string, FieldRule> = {
  applicantMemberId: { label: 'member', type: 'id' },
  applicantName: {
    label: 'applicant name',
    maxLength: LIMITS.name.max,
    custom: (value, values) =>
      !value && !values.applicantMemberId
        ? 'Please choose a member, or enter the applicant name.'
        : undefined,
  },
  amount: { label: 'amount', type: 'number', required: true, min: 1, max: LIMITS.amount.max },
  repaymentMonths: { label: 'repayment term', type: 'integer', required: true, min: 1, max: 600 },
  purpose: { label: 'purpose', required: true },
  purposeDetails: { label: 'purpose details', maxLength: 1000 },
  notes: { label: 'notes', maxLength: LIMITS.notes.max },
};

export default function LoanCreate() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const { errors, validate, clearField } = useFormValidation(RULES);
  const [form, setForm] = useState({
    applicantMemberId: '',
    applicantName: '',
    amount: '',
    purpose: 'medical',
    purposeDetails: '',
    repaymentMonths: '12',
    notes: '',
  });

  useEffect(() => {
    // /members caps `limit` at 100 and answers 400 above it, so the old
    // `limit: 200` request always failed and this picker was always empty.
    fetchAllPages((params) => memberService.getAll(params))
      .then((rows) => setMembers(rows))
      .catch((err) => {
        setMembers([]);
        toast.error(loadErrorMessage(err, 'members'));
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Every field at once, each message on its own field - a form with three
    // problems used to show one sentence in a banner and mark nothing.
    if (!validate(form)) return;
    if (saving) return; // a second click while the first request is open

    try {
      setSaving(true);
      const loan = await qardService.createLoan({
        applicantMemberId: form.applicantMemberId || undefined,
        applicantName: form.applicantName || undefined,
        amount: Number(form.amount),
        purpose: form.purpose,
        purposeDetails: form.purposeDetails || undefined,
        repaymentMonths: Number(form.repaymentMonths),
        notes: form.notes || undefined,
      });
      toast.success('Loan application created');
      navigate(`/loans/${loan.id}`);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'create the application' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <PageHeader
        title="New Qard Hasan Application"
        description="Created as applied; approval and disbursement are separate steps"
        breadcrumbs={[{ label: 'Qard Hasan', path: '/loans' }]}
      />

      <form onSubmit={handleSubmit}>
        <Card>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <SearchableSelect
                    label="Member"
                    value={form.applicantMemberId}
                    onChange={(value) => setForm({ ...form, applicantMemberId: value })}
                    options={members.map((member: any) => ({
                      value: member._id || member.id,
                      label: `${toTitleCase(member.name)}${member.familyName ? ` - ${toTitleCase(member.familyName)}` : ''}`,
                    }))}
                    placeholder="Search members..."
                    error={errors.applicantMemberId}
                    helperText="Leave blank for a non-member applicant"
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
              label="Applicant name (non-member)"
              value={form.applicantName}
              onChange={(e) => {
                clearField('applicantName');
                setForm({ ...form, applicantName: e.target.value });
              }}
              error={errors.applicantName}
              placeholder="Required when no member is selected"
            />

            <Input
              label="Amount requested"
              type="number"
              min={0}
              value={form.amount}
              onChange={(e) => {
                clearField('amount');
                setForm({ ...form, amount: e.target.value });
              }}
              error={errors.amount}
              placeholder="0"
              required
            />

            <Input
              label="Repayment term (months)"
              type="number"
              min={1}
              value={form.repaymentMonths}
              onChange={(e) => {
                clearField('repaymentMonths');
                setForm({ ...form, repaymentMonths: e.target.value });
              }}
              error={errors.repaymentMonths}
              helperText="The schedule is generated over this many months on disbursement"
              required
            />

            <Select
              label="Purpose"
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              options={LOAN_PURPOSE_OPTIONS}
              required
            />

            <Input
              label="Purpose details"
              value={form.purposeDetails}
              onChange={(e) => {
                clearField('purposeDetails');
                setForm({ ...form, purposeDetails: e.target.value });
              }}
              error={errors.purposeDetails}
              placeholder="Optional"
            />

            <div className="md:col-span-2">
              <Input
                label="Notes"
                value={form.notes}
                onChange={(e) => {
                  clearField('notes');
                  setForm({ ...form, notes: e.target.value });
                }}
                error={errors.notes}
              />
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => navigate('/loans')}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Create Application'}
            </Button>
          </div>
        </Card>
      </form>

      <QuickAddMember
        open={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        onCreated={(newMember) => {
          setMembers((prev) => [...prev, newMember]);
          setForm({ ...form, applicantMemberId: newMember.id });
        }}
      />
    </div>
  );
}
