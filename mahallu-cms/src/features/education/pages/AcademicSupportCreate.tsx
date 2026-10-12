import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
  SUPPORT_CASE_TYPE_OPTIONS,
  SUPPORT_CASE_STATUS_OPTIONS,
} from '@/services/scholarshipService';
import { memberService } from '@/services/memberService';

export default function AcademicSupportCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [formData, setFormData] = useState({
    memberId: '',
    type: 'career_guidance',
    description: '',
    mentorName: '',
    startDate: new Date().toISOString().split('T')[0],
    status: 'open',
    outcome: '',
    notes: '',
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
      await scholarshipService.createSupportCase({
        ...formData,
        startDate: new Date(formData.startDate).toISOString(),
      });
      const member = members.find((m) => m.id === formData.memberId);
      toast.success(`Support case created for ${member?.name || 'student'}`);
      navigate('/education/support');
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create case. Check the details and try again."));
      toast.error(getFriendlyError(err, "Couldn't create case. Check the details and try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="New academic support case" description="Record mentoring or academic help for a student" />

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Case details</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Who needs support and what kind</p>
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

            <Select
              label="Type"
              name="type"
              value={formData.type}
              onChange={handleChange}
              options={SUPPORT_CASE_TYPE_OPTIONS}
              required
            />

            <Select
              label="Status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              options={SUPPORT_CASE_STATUS_OPTIONS}
            />

            <div className="md:col-span-2">
              <label htmlFor="case-description" className={labelClasses}>
                Description<span className="ml-0.5 text-[#D9534F]">*</span>
              </label>
              <textarea
                id="case-description"
                name="description"
                placeholder="Describe the case..."
                value={formData.description}
                onChange={handleChange}
                required
                rows={4}
                className={`${controlClasses} py-2`}
              />
            </div>
          </div>
        </Card>

        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Mentoring</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Mentor, start date and notes</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Mentor Name"
              name="mentorName"
              placeholder="Mentor name"
              value={formData.mentorName}
              onChange={handleChange}
            />

            <Input
              label="Start Date"
              type="date"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
            />

            <div className="md:col-span-2">
              <label htmlFor="case-notes" className={labelClasses}>Notes</label>
              <textarea
                id="case-notes"
                name="notes"
                placeholder="Additional notes..."
                value={formData.notes}
                onChange={handleChange}
                rows={3}
                className={`${controlClasses} py-2`}
              />
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/education/support')}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Case'}
          </Button>
        </div>
      </form>
    </div>
  );
}
