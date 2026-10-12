import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import SearchableSelect from '@/components/ui/SearchableSelect';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import {
  scholarshipService,
  AWARD_STATUS_OPTIONS,
} from '@/services/scholarshipService';
import { memberService } from '@/services/memberService';

export default function AwardCreate() {
  const navigate = useNavigate();
  const { scholarshipId } = useParams<{ scholarshipId: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [formData, setFormData] = useState({
    memberId: '',
    amount: '',
    awardedDate: new Date().toISOString().split('T')[0],
    status: 'applied',
    remarks: '',
  });

  useEffect(() => {
    memberService
      .getAll({ page: 1, limit: 200 } as any)
      .then((result: any) => setMembers(result.data || []))
      .catch(() => setMembers([]))
      .finally(() => setLoadingMembers(false));
  }, []);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await scholarshipService.createAward({
        scholarshipId,
        memberId: formData.memberId,
        amount: parseInt(formData.amount),
        awardedDate: new Date(formData.awardedDate).toISOString(),
        status: formData.status,
        remarks: formData.remarks || undefined,
      });
      const member = members.find((m) => m.id === formData.memberId);
      toast.success(`Award created for ${member?.name || 'student'}`);
      navigate(`/education/scholarships/${scholarshipId}/awards`);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create award. Check the details and try again."));
      toast.error(getFriendlyError(err, "Couldn't create award. Check the details and try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="New scholarship award" description="Award a scholarship to a student" />

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Award details</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Student, amount and status of the award</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <SearchableSelect
                label="Student"
                value={formData.memberId}
                onChange={(value) =>
                  setFormData((prev) => ({ ...prev, memberId: value }))
                }
                options={members.map((member: any) => ({
                  value: member.id,
                  label: `${member.name}${member.familyName ? ` - ${member.familyName}` : ''}`,
                }))}
                placeholder="Search members..."
                isLoading={loadingMembers}
                required
              />
            </div>

            <Input
              label="Amount"
              type="number"
              name="amount"
              placeholder="Amount"
              value={formData.amount}
              onChange={handleChange}
              required
              min="0"
            />

            <Select
              label="Status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              options={AWARD_STATUS_OPTIONS}
            />

            <Input
              label="Awarded Date"
              type="date"
              name="awardedDate"
              value={formData.awardedDate}
              onChange={handleChange}
            />

            <div className="md:col-span-2">
              <label htmlFor="award-remarks" className={labelClasses}>Remarks</label>
              <textarea
                id="award-remarks"
                name="remarks"
                placeholder="Additional remarks..."
                value={formData.remarks}
                onChange={handleChange}
                rows={3}
                className={`${controlClasses} py-2`}
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate(`/education/scholarships/${scholarshipId}/awards`)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Award'}
          </Button>
        </div>
      </form>
    </div>
  );
}
