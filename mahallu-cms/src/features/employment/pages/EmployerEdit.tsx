import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { employmentService, type Employer } from '@/services/employmentService';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function EmployerEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [employer, setEmployer] = useState<Employer | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<Employer>>({});

  useEffect(() => {
    const fetchEmployer = async () => {
      try {
        if (id) {
          const data = await employmentService.getEmployer(id);
          setEmployer(data);
          setFormData(data);
        }
      } catch (error) {
        console.error('Failed to fetch employer:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployer();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    try {
      const updated = await employmentService.updateEmployer(id, {
        name: formData.name,
        businessType: formData.businessType,
        contactPerson: formData.contactPerson,
        contactNo: formData.contactNo,
        location: formData.location,
        notes: formData.notes,
        status: formData.status,
      });

      setEmployer(updated);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update employer:', error);
    }
  };

  if (loading) {
    return <Card className="p-8 text-center">Loading employer details...</Card>;
  }

  if (!employer) {
    return (
      <Card className="p-8 text-center text-gray-500">
        <p>Employer not found</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/employment/employers')} className="p-2 hover:bg-gray-100 rounded text-lg">
            ←
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{employer.name}</h1>
        </div>
        <div className="flex gap-2">
          {!isEditing && (
            <>
              <Button onClick={() => setIsEditing(true)} className="bg-blue-600 text-white">
                Edit
              </Button>
              <Button
                onClick={() => {
                  if (confirm('Delete this employer?')) {
                    employmentService.deleteEmployer(employer._id).then(() => navigate('/employment/employers'));
                  }
                }}
                className="bg-red-600 text-white"
              >
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-xs text-gray-600">Business Type</div>
          <div className="font-semibold text-gray-900">{employer.businessType || '—'}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-gray-600">Contact Person</div>
          <div className="font-semibold text-gray-900">{employer.contactPerson || '—'}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-gray-600">Status</div>
          <div className="font-semibold text-gray-900 capitalize">{employer.status}</div>
        </Card>
      </div>

      <Card>
        {isEditing ? (
          <form onSubmit={handleSave} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Employer Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Business Type</label>
                <input
                  type="text"
                  name="businessType"
                  value={formData.businessType || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Contact Person</label>
                <input
                  type="text"
                  name="contactPerson"
                  value={formData.contactPerson || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Contact Number</label>
                <input
                  type="tel"
                  name="contactNo"
                  value={formData.contactNo || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Location</label>
                <input
                  type="text"
                  name="location"
                  value={formData.location || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Status</label>
                <select
                  name="status"
                  value={formData.status || 'active'}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Notes</label>
              <textarea
                name="notes"
                value={formData.notes || ''}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <Button onClick={() => setIsEditing(false)} className="bg-gray-200 text-gray-800">
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 text-white">
                Save Changes
              </Button>
            </div>
          </form>
        ) : (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold text-gray-900 mb-2">Details</h3>
              <div className="space-y-3 text-sm text-gray-700">
                {employer.contactNo && (
                  <div>
                    <span className="font-medium">Phone:</span> {employer.contactNo}
                  </div>
                )}
                {employer.location && (
                  <div>
                    <span className="font-medium">Location:</span> {employer.location}
                  </div>
                )}
                {employer.notes && (
                  <div>
                    <span className="font-medium">Notes:</span>
                    <p className="mt-1 whitespace-pre-wrap">{employer.notes}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="text-sm text-gray-500">
              Added on {new Date(employer.createdAt).toLocaleDateString()}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
