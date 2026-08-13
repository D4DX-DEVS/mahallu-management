import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { toast } from '@/store/toastStore';
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
      setError(err.response?.data?.message || 'Failed to create scholarship');
      toast.error(err.response?.data?.message || 'Failed to create scholarship');
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700';
  const errorClass = 'mt-1 text-xs text-red-600 dark:text-red-400';

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">New Scholarship</h1>

      <Card>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 p-3 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name *</label>
              <input
                name="name"
                placeholder="Scholarship name"
                value={formData.name}
                onChange={handleChange}
                className={inputClass}
              />
              {fieldErrors.name && <p className={errorClass}>{fieldErrors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Name (Malayalam)</label>
              <input
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
                type="number"
                name="amount"
                min={1}
                placeholder="Amount"
                value={formData.amount}
                onChange={handleChange}
                className={inputClass}
              />
              {fieldErrors.amount && <p className={errorClass}>{fieldErrors.amount}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Academic Year *</label>
              <input
                name="academicYear"
                placeholder="e.g. 2026-2027"
                value={formData.academicYear}
                onChange={handleChange}
                className={inputClass}
              />
              {fieldErrors.academicYear && <p className={errorClass}>{fieldErrors.academicYear}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Eligibility Criteria</label>
            <textarea
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
            <select name="status" value={formData.status} onChange={handleChange} className={inputClass}>
              {SCHOLARSHIP_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex gap-4">
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
