import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import QuickAddMember from '@/components/quick-add/QuickAddMember';
import { toast } from '@/store/toastStore';
import { qardService, LOAN_PURPOSE_OPTIONS } from '@/services/qardService';
import { memberService } from '@/services/memberService';
import { Member } from '@/types';
import { FiPlus } from 'react-icons/fi';

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
      navigate(`/loans/${loan._id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create the application');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            New Qard Hasan Application
          </h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Created as applied; approval and disbursement are separate steps
          </p>
        </div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Qard Hasan', path: '/loans' },
            { label: 'New' },
          ]}
        />
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-3 sm:p-4">
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
                      label: `${member.name}${member.familyName ? ` - ${member.familyName}` : ''}`,
                    }))}
                    placeholder="Search members..."
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
              onChange={(e) => setForm({ ...form, applicantName: e.target.value })}
              placeholder="Required when no member is selected"
            />

            <Input
              label="Amount requested"
              type="number"
              min={0}
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
