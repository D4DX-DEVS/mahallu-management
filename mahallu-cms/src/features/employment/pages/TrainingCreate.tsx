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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      toast.error(getFriendlyError(err, "Couldn't create training. Check the details and try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Create Skill Training" description="Add a new skill training for the community" />

      <Card padding="none">
        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          {error && <Alert tone="danger">{error}</Alert>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Input label="Training Name" type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="e.g., Web Development Bootcamp" />
            </div>

            <div>
              <Input label="Trainer Name" type="text" name="trainerName" value={formData.trainerName} onChange={handleChange} placeholder="Name of the trainer" />
            </div>

            <div>
              <Input label="Start Date" type="date" name="startDate" value={formData.startDate} onChange={handleChange} required />
            </div>

            <div>
              <Input label="End Date" type="date" name="endDate" value={formData.endDate} onChange={handleChange} required />
            </div>

            <div>
              <label className={labelClasses}>Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className={`${controlClasses} h-9`}
              >
                <option value="planned">Planned</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={() => navigate('/employment/trainings')}>
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
