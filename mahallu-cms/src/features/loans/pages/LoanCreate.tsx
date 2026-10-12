import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import PageHeader from '@/components/ui/PageHeader';
import QuickAddMember from '@/components/quick-add/QuickAddMember';
import { toast } from '@/store/toastStore';
import { qardService, LOAN_PURPOSE_OPTIONS } from '@/services/qardService';
import { memberService } from '@/services/memberService';
import { Member } from '@/types';
import { FiPlus } from 'react-icons/fi';
import AmountInput from '@/components/ui/AmountInput';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import UnsavedChangesDialog from '@/components/ui/UnsavedChangesDialog';
import { getFriendlyError } from '@/utils/apiMessages';

export default function LoanCreate() {
  const navigate = useNavigate();
  const [members, setMembers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [form, setForm] = useState({
    applicantMemberId: '',
    applicantName: '',
    amount: '',
    purpose: 'medical',
    purposeDetails: '',
    repaymentMonths: '12',
    notes: '',
  });
  const initialForm = useRef(JSON.stringify(form));
  const guard = useUnsavedChangesGuard(!saving && JSON.stringify(form) !== initialForm.current);

  useEffect(() => {
    memberService
      .getAll({ page: 1, limit: 200 } as any)
      .then((result: any) => setMembers(result.data || []))
      .catch(() => setMembers([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.applicantMemberId && !form.applicantName.trim()) {
      setError('Pick a member or enter an applicant name');
      return;
    }
    if (!(Number(form.amount) > 0)) {
      setError('Enter the amount being requested');
      return;
    }
    if (!(Number(form.repaymentMonths) >= 1)) {
      setError('Repayment term must be at least one month');
      return;
    }

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
      toast.error(getFriendlyError(err, "Couldn't create the application. Check the details and try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="New Qard Hasan Application"
        description="Created as applied; approval and disbursement are separate steps"
      />

      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          <Card>
            <div className="mb-3.5">
              <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Application details</h2>
              <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Applicant, amount and repayment terms</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <SearchableSelect
                      label="Member"
                      value={form.applicantMemberId}
                      onChange={(value) => setForm({ ...form, applicantMemberId: value })}
                      options={members.map((member: any) => ({
                        value: member.id,
                        label: `${member.name}${member.familyName ? ` - ${member.familyName}` : ''}`,
                      }))}
                      placeholder="Search members..."
                      helperText="Leave blank for a non-member applicant"
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
                label="Applicant name (non-member)"
                value={form.applicantName}
                onChange={(e) => setForm({ ...form, applicantName: e.target.value })}
                placeholder="Required when no member is selected"
              />

              <AmountInput
                label="Amount requested"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
                required
              />

              <Input
                label="Repayment term (months)"
                type="number"
                min={1}
                value={form.repaymentMonths}
                onChange={(e) => setForm({ ...form, repaymentMonths: e.target.value })}
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
                onChange={(e) => setForm({ ...form, purposeDetails: e.target.value })}
                placeholder="Optional"
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
            <Button type="button" variant="secondary" onClick={() => guard.guardedNavigate('/loans')}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Create Application'}
            </Button>
          </div>
        </div>
      </form>

      <QuickAddMember
        open={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        onCreated={(newMember) => {
          setMembers((prev) => [...prev, newMember]);
          setForm({ ...form, applicantMemberId: newMember.id });
        }}
      />
      <UnsavedChangesDialog guard={guard} />
    </div>
  );
}
