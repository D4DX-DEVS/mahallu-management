import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { toast } from '@/store/toastStore';
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
      const member = members.find((m) => m._id === formData.memberId);
      toast.success(`Award created for ${member?.name || 'student'}`);
      navigate(`/education/scholarships/${scholarshipId}/awards`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create award');
      toast.error(err.response?.data?.message || 'Failed to create award');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New Scholarship Award</h1>

      <Card>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-3 rounded">
              {error}
            </div>
          )}

          <div>
            <SearchableSelect
              label="Student *"
              value={formData.memberId}
              onChange={(value) =>
                setFormData((prev) => ({ ...prev, memberId: value }))
              }
              options={members.map((member: any) => ({
                value: member._id || member.id,
                label: `${member.name}${member.familyName ? ` - ${member.familyName}` : ''}`,
              }))}
              placeholder="Search members..."
              isLoading={loadingMembers}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Amount *</label>
              <input
                type="number"
                name="amount"
                placeholder="Amount"
                value={formData.amount}
                onChange={handleChange}
                required
                min="0"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
              >
                {AWARD_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Awarded Date</label>
            <input
              type="date"
              name="awardedDate"
              value={formData.awardedDate}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Remarks</label>
            <textarea
              name="remarks"
              placeholder="Additional remarks..."
              value={formData.remarks}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            />
          </div>

          <div className="flex gap-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Award'}
            </Button>
            <Button
              type="button"
              onClick={() => navigate(`/education/scholarships/${scholarshipId}/awards`)}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
