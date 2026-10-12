import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { scholarshipService, SCHOLARSHIP_STATUS_OPTIONS } from '@/services/scholarshipService';

export default function ScholarshipCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; amount?: string; academicYear?: string }>({});
  const currentYear = new Date().getFullYear();
  const [formData, setFormData] = useState({
    name: '',
    nameMl: '',
    amount: '',
    academicYear: `${currentYear}-${currentYear + 1}`,
    criteria: '',
    status: 'active',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (fieldErrors[name as keyof typeof fieldErrors]) {
      setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
    }
  };

  const validate = () => {
    const errs: typeof fieldErrors = {};
    if (!formData.name.trim()) errs.name = 'Name is required';
    if (!formData.amount || Number(formData.amount) <= 0) errs.amount = 'Enter an amount greater than 0';
    if (!formData.academicYear.trim()) errs.academicYear = 'Academic year is required';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setError('');
    try {
      await scholarshipService.createScholarship({
        name: formData.name.trim(),
        nameMl: formData.nameMl.trim() || undefined,
        amount: Number(formData.amount),
        academicYear: formData.academicYear.trim(),
        criteria: formData.criteria.trim() || undefined,
        status: formData.status,
      });
      toast.success(`Scholarship "${formData.name}" created`);
      navigate('/education/scholarships');
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create scholarship. Check the details and try again."));
      toast.error(getFriendlyError(err, "Couldn't create scholarship. Check the details and try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="New scholarship" description="Define a scholarship scheme and who qualifies" />

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Scholarship details</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Name, amount, year and eligibility</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Name *"
              name="name"
              placeholder="Scholarship name"
              value={formData.name}
              onChange={handleChange}
              error={fieldErrors.name}
            />
            <Input
              label="Name (Malayalam)"
              name="nameMl"
              placeholder="പേര്"
              value={formData.nameMl}
              onChange={handleChange}
              className="font-malayalam"
            />
            <Input
              label="Amount (₹) *"
              type="number"
              name="amount"
              min={1}
              placeholder="Amount"
              value={formData.amount}
              onChange={handleChange}
              error={fieldErrors.amount}
            />
            <Input
              label="Academic Year *"
              name="academicYear"
              placeholder="e.g. 2026-2027"
              value={formData.academicYear}
              onChange={handleChange}
              error={fieldErrors.academicYear}
            />
            <div className="md:col-span-2">
              <label htmlFor="scholarship-criteria" className={labelClasses}>Eligibility Criteria</label>
              <textarea
                id="scholarship-criteria"
                name="criteria"
                placeholder="Who qualifies for this scholarship..."
                value={formData.criteria}
                onChange={handleChange}
                rows={3}
                className={`${controlClasses} py-2`}
              />
            </div>
            <Select
              label="Status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              options={SCHOLARSHIP_STATUS_OPTIONS}
            />
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/education/scholarships')}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Scholarship'}
          </Button>
        </div>
      </form>
    </div>
  );
}
