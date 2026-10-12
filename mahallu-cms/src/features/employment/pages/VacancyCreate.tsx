import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { employmentService } from '@/services/employmentService';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      toast.error(getFriendlyError(err, "Couldn't create vacancy. Check the details and try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Post New Job Vacancy" description="Publish a job opening for job seekers" />

      <Card padding="none">
        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          {error && <Alert tone="danger">{error}</Alert>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Input label="Job Title" type="text" name="title" value={formData.title} onChange={handleChange} required placeholder="e.g., Software Developer" />
            </div>

            <div>
              <Input label="Employer Name" type="text" name="employerName" value={formData.employerName} onChange={handleChange} placeholder="Company name (for one-off posts)" />
            </div>

            <div>
              <Input label="Location" type="text" name="location" value={formData.location} onChange={handleChange} placeholder="e.g., Kochi" />
            </div>

            <div>
              <Input label="Salary Range" type="text" name="salaryRange" value={formData.salaryRange} onChange={handleChange} placeholder="e.g., 25,000 - 40,000 per month" />
            </div>
          </div>

          <div>
            <Input label="Required Skills" type="text" name="skillsRequired" value={formData.skillsRequired} onChange={handleChange} placeholder="Comma-separated (e.g., Java, React, SQL)" />
            <p className="text-xs text-gray-500 mt-1">Separate multiple skills with commas</p>
          </div>

          <div>
            <label className={labelClasses}>Job Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              className={`${controlClasses} py-2`}
              placeholder="Enter detailed job description..."
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={() => navigate('/employment/vacancies')}>
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
