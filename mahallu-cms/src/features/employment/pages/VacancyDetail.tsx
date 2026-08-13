import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { employmentService, type JobVacancy } from '@/services/employmentService';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';

export default function VacancyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vacancy, setVacancy] = useState<JobVacancy | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<JobVacancy>>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchVacancy = async () => {
      try {
        if (id) {
          const data = await employmentService.getVacancy(id);
          setVacancy(data);
          setFormData(data);
        }
      } catch (error) {
        console.error('Failed to fetch vacancy:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVacancy();
  }, [id]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    try {
      const updated = await employmentService.updateVacancy(id, {
        title: formData.title,
        location: formData.location,
        salaryRange: formData.salaryRange,
        status: formData.status,
        description: formData.description,
        skillsRequired: Array.isArray(formData.skillsRequired)
          ? formData.skillsRequired
          : (formData.skillsRequired as string)?.split(',').map((s: string) => s.trim()) || [],
      });

      setVacancy(updated);
      setIsEditing(false);
      toast.success('Vacancy updated successfully');
    } catch (error) {
      toast.error('Failed to update vacancy');
      console.error('Failed to update vacancy:', error);
    }
  };

  const handleConfirmDelete = async () => {
    if (!vacancy) return;
    try {
      setDeleting(true);
      await employmentService.deleteVacancy(vacancy._id);
      toast.success('Vacancy deleted successfully');
      navigate('/employment/vacancies');
    } catch (error) {
      toast.error('Failed to delete vacancy');
      console.error('Failed to delete vacancy:', error);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <Card className="p-8 text-center">Loading vacancy details...</Card>;
  }

  if (!vacancy) {
    return (
      <Card className="p-8 text-center text-gray-500">
        <p>Vacancy not found</p>
      </Card>
    );
  }

  const employerName =
    vacancy.employerId && typeof vacancy.employerId === 'object'
      ? vacancy.employerId.name
      : vacancy.employerName || 'One-off post';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/employment/vacancies')} className="p-2 hover:bg-gray-100 rounded text-lg">
            ←
          </button>
          <h1 className="text-2xl font-bold text-gray-900">{vacancy.title}</h1>
        </div>
        <div className="flex gap-2">
          {!isEditing && (
            <>
              <Button onClick={() => setIsEditing(true)} className="bg-blue-600 text-white">
                Edit
              </Button>
              <Button
                onClick={() => setShowDeleteConfirm(true)}
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
          <div className="text-xs text-gray-600">Employer</div>
          <div className="font-semibold text-gray-900">{employerName}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-gray-600">Location</div>
          <div className="font-semibold text-gray-900">{vacancy.location || '—'}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-gray-600">Salary Range</div>
          <div className="font-semibold text-gray-900">{vacancy.salaryRange || '—'}</div>
        </Card>
      </div>

      <Card>
        {isEditing ? (
          <form onSubmit={handleSave} className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Job Title</label>
                <input
                  type="text"
                  name="title"
                  value={formData.title || ''}
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
                <label className="block text-sm font-medium text-gray-900 mb-2">Salary Range</label>
                <input
                  type="text"
                  name="salaryRange"
                  value={formData.salaryRange || ''}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Status</label>
                <select
                  name="status"
                  value={formData.status || 'open'}
                  onChange={handleChange}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="open">Open</option>
                  <option value="filled">Filled</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Required Skills</label>
              <input
                type="text"
                name="skillsRequired"
                value={
                  Array.isArray(formData.skillsRequired)
                    ? formData.skillsRequired.join(', ')
                    : formData.skillsRequired || ''
                }
                onChange={handleChange}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Description</label>
              <textarea
                name="description"
                value={formData.description || ''}
                onChange={handleChange}
                rows={4}
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
              <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
              <p className="text-gray-700 whitespace-pre-wrap">{vacancy.description || 'No description provided'}</p>
            </div>

            {vacancy.skillsRequired && vacancy.skillsRequired.length > 0 && (
              <div>
                <h3 className="font-semibold text-gray-900 mb-2">Required Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {vacancy.skillsRequired.map((skill, idx) => (
                    <span key={idx} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="text-sm text-gray-500">
              Posted on {new Date(vacancy.postedDate).toLocaleDateString()}
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Job Vacancy"
        message="Are you sure you want to delete this job vacancy?"
        consequence="All vacancy details and associated data will be permanently removed."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </div>
  );
}
