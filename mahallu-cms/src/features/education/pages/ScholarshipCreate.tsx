import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { toast } from '@/store/toastStore';
import { scholarshipService, SCHOLARSHIP_STATUS_OPTIONS } from '@/services/scholarshipService';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { useFormValidation } from '@/hooks/useFormValidation';
import { FieldRule, LIMITS, firstError, validateForm } from '@/utils/validation';

/**
 * The same limits the API applies, so a form that passes here is not
 * refused there. Required matches what each input already declares.
 */
const RULES: Record<string, FieldRule> = {
  name: { label: 'scholarship name', required: true, maxLength: LIMITS.title.max },
  nameMl: { label: 'name', maxLength: LIMITS.title.max },
  amount: { label: 'amount', required: true, type: 'number', min: 1, max: LIMITS.amount.max },
  academicYear: { label: 'academic year', required: true, type: 'academicYear' },
  criteria: { label: 'criteria', maxLength: LIMITS.description.max },
  status: { label: 'status', maxLength: LIMITS.shortText.max },
};

export default function ScholarshipCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const currentYear = new Date().getFullYear();
  const [formData, setFormData] = useState({
    name: '',
    nameMl: '',
    amount: '',
    academicYear: `${currentYear}-${currentYear + 1}`,
    criteria: '',
    status: 'active',
  });
  const { errors, setErrors, clearField } = useFormValidation(RULES);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    clearField(name);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Every field checked at once. Fields rendered with this app's
    // inputs mark themselves; the rest report through the banner.
    const problems = validateForm(formData, RULES);
    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      setError(firstError(problems));
      return;
    }
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
      setError(errorMessage(err, { action: 'create scholarship' }));
      toast.error(errorMessage(err, { action: 'create scholarship' }));
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700';
  const errorClass = 'mt-1 text-xs text-red-600 dark:text-red-400';

  return (
    <div className="space-y-6">
      <PageHeader title="New Scholarship" />
      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-3 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name *</label>
              <input
                aria-label="Name"
                name="name"
                placeholder="Scholarship name"
                value={formData.name}
                onChange={handleChange}
                className={inputClass}
              />
              {errors.name && <p className={errorClass}>{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Name (Malayalam)</label>
              <input
                aria-label="Name (Malayalam)"
                name="nameMl"
                placeholder="പേര്"
                value={formData.nameMl}
                onChange={handleChange}
                className={`${inputClass} font-malayalam`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Amount (₹) *</label>
              <input
                aria-label="Amount (₹)"
                type="number"
                name="amount"
                min={1}
                placeholder="Amount"
                value={formData.amount}
                onChange={handleChange}
                className={inputClass}
              />
              {errors.amount && <p className={errorClass}>{errors.amount}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Academic Year *</label>
              <input
                aria-label="Academic Year"
                name="academicYear"
                placeholder="e.g. 2026-2027"
                value={formData.academicYear}
                onChange={handleChange}
                className={inputClass}
              />
              {errors.academicYear && <p className={errorClass}>{errors.academicYear}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Eligibility Criteria</label>
            <textarea
              aria-label="Eligibility Criteria"
              name="criteria"
              placeholder="Who qualifies for this scholarship..."
              value={formData.criteria}
              onChange={handleChange}
              rows={3}
              className={inputClass}
            />
          </div>

          <div className="md:w-1/2">
            <label className="block text-sm font-medium mb-2">Status</label>
            <select
              aria-label="Status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className={inputClass}
            >
              {SCHOLARSHIP_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-4">
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Scholarship'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate('/education/scholarships')}>
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
