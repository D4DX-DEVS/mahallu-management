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

export default function EmployerCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    businessType: '',
    contactPerson: '',
    contactNo: '',
    location: '',
    notes: '',
    status: 'active',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await employmentService.createEmployer({
        name: formData.name,
        businessType: formData.businessType || undefined,
        contactPerson: formData.contactPerson || undefined,
        contactNo: formData.contactNo || undefined,
        location: formData.location || undefined,
        notes: formData.notes || undefined,
        status: formData.status,
      });

      navigate('/employment/employers');
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create employer. Check the details and try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Add New Employer" description="Register an employer who can post vacancies" />

      <Card padding="none">
        <form onSubmit={handleSubmit} className="space-y-5 p-5">
          {error && <Alert tone="danger">{error}</Alert>}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Input label="Employer Name" type="text" name="name" value={formData.name} onChange={handleChange} required placeholder="e.g., ABC Corporation" />
            </div>

            <div>
              <Input label="Business Type" type="text" name="businessType" value={formData.businessType} onChange={handleChange} placeholder="e.g., Technology, Manufacturing" />
            </div>

            <div>
              <Input label="Contact Person" type="text" name="contactPerson" value={formData.contactPerson} onChange={handleChange} placeholder="Name of contact" />
            </div>

            <div>
              <Input label="Contact Number" type="tel" name="contactNo" value={formData.contactNo} onChange={handleChange} placeholder="Phone number" />
            </div>

            <div>
              <Input label="Location" type="text" name="location" value={formData.location} onChange={handleChange} placeholder="e.g., Kochi, Kerala" />
            </div>

            <div>
              <label className={labelClasses}>Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className={`${controlClasses} h-9`}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className={labelClasses}>Notes</label>
            <textarea
              name="notes"
              value={formData.notes}
              onChange={handleChange}
              rows={3}
              className={`${controlClasses} py-2`}
              placeholder="Additional notes about the employer..."
            />
          </div>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={() => navigate('/employment/employers')}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Employer'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
