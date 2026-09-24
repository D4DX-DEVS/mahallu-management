import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { employmentService } from '@/services/employmentService';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { useFormValidation } from '@/hooks/useFormValidation';
import { FieldRule, LIMITS, firstError, validateForm } from '@/utils/validation';

/**
 * The same limits the API applies, so a form that passes here is not
 * refused there. Required matches what each input already declares.
 */
const RULES: Record<string, FieldRule> = {
  title: { label: 'title', required: true, maxLength: LIMITS.title.max },
  employerName: { label: 'employer name', maxLength: LIMITS.title.max },
  location: { label: 'location', maxLength: LIMITS.shortText.max },
  salaryRange: { label: 'salary range', maxLength: LIMITS.shortText.max },
  description: { label: 'description', maxLength: LIMITS.description.max },
};

export default function VacancyCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    employerName: '',
    location: '',
    salaryRange: '',
    skillsRequired: '',
    description: '',
  });
  const { errors, setErrors } = useFormValidation(RULES);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
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
      await employmentService.createVacancy({
        title: formData.title,
        employerName: formData.employerName || undefined,
        location: formData.location || undefined,
        salaryRange: formData.salaryRange || undefined,
        skillsRequired: formData.skillsRequired
          ? formData.skillsRequired.split(',').map((s) => s.trim())
          : [],
        description: formData.description || undefined,
        status: 'open',
        postedDate: new Date().toISOString(),
      });

      navigate('/employment/vacancies');
    } catch (err: any) {
      setError(errorMessage(err, { action: 'create vacancy' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/employment/vacancies')}
          className="p-2 hover:bg-gray-100 rounded text-lg"
        >
          ←
        </button>
        <PageHeader title="Post New Job Vacancy" />
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Job Title *</label>
              <input
                aria-label="Job Title"
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Software Developer"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Employer Name</label>
              <input
                aria-label="Employer Name"
                type="text"
                name="employerName"
                value={formData.employerName}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Company name (for one-off posts)"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Location</label>
              <input
                aria-label="Location"
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Kochi"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Salary Range</label>
              <input
                aria-label="Salary Range"
                type="text"
                name="salaryRange"
                value={formData.salaryRange}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 25,000 - 40,000 per month"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Required Skills</label>
            <input
              aria-label="Required Skills"
              type="text"
              name="skillsRequired"
              value={formData.skillsRequired}
              onChange={handleChange}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Comma-separated (e.g., Java, React, SQL)"
            />
            <p className="text-xs text-gray-500 mt-1">Separate multiple skills with commas</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Job Description</label>
            <textarea
              aria-label="Job Description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter detailed job description..."
            />
          </div>

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-3">
            <Button
              type="button"
              onClick={() => navigate('/employment/vacancies')}
              className="bg-gray-200 text-gray-800 hover:bg-gray-300"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Vacancy'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
