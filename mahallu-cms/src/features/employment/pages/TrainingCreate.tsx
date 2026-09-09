import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { employmentService } from '@/services/employmentService';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import Input from '@/components/ui/Input';
import { useFormValidation } from '@/hooks/useFormValidation';
import { FieldRule, LIMITS, firstError, validateForm } from '@/utils/validation';

/**
 * The same limits the API applies, so a form that passes here is not
 * refused there. Required matches what each input already declares.
 */
const RULES: Record<string, FieldRule> = {
  name: { label: 'name', required: true, maxLength: LIMITS.title.max },
  trainerName: { label: 'trainer name', maxLength: LIMITS.title.max },
  startDate: { label: 'start date', required: true, type: 'date' },
  endDate: { label: 'end date', required: true, type: 'date', notBefore: 'startDate', notBeforeLabel: 'start date' },
  status: { label: 'status', maxLength: LIMITS.shortText.max },
};

export default function TrainingCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    trainerName: '',
    startDate: '',
    endDate: '',
    status: 'planned',
  });
  const { errors, setErrors } = useFormValidation(RULES);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
      await employmentService.createTraining({
        name: formData.name,
        trainerName: formData.trainerName || undefined,
        startDate: formData.startDate,
        endDate: formData.endDate,
        status: formData.status as 'planned' | 'ongoing' | 'completed' | 'cancelled',
        participants: [],
      });

      navigate('/employment/trainings');
    } catch (err: any) {
      setError(errorMessage(err, { action: 'create training' }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/employment/trainings')}
          className="p-2 hover:bg-gray-100 rounded text-lg"
        >
          ←
        </button>
        <PageHeader title="Create Skill Training" />
      </div>

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">{error}</div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Training Name *</label>
              <input
                aria-label="Training Name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Web Development Bootcamp"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Trainer Name</label>
              <input
                aria-label="Trainer Name"
                type="text"
                name="trainerName"
                value={formData.trainerName}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Name of the trainer"
              />
            </div>

            <Input
              label="Start date"
              type="date"
              name="startDate"
              value={formData.startDate}
              error={errors.startDate}
              onChange={handleChange}
              required
            />

            <Input
              label="End date"
              type="date"
              name="endDate"
              value={formData.endDate}
              error={errors.endDate}
              onChange={handleChange}
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Status</label>
              <select
                aria-label="Status"
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="planned">Planned</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-3">
            <Button
              type="button"
              onClick={() => navigate('/employment/trainings')}
              className="bg-gray-200 text-gray-800 hover:bg-gray-300"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Training'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
