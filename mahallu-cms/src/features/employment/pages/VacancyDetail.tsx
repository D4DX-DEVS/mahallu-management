import { useEffect, useState } from 'react';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import { useParams, useNavigate } from 'react-router-dom';
import { employmentService, type JobVacancy } from '@/services/employmentService';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import PageHeader from '@/components/layout/PageHeader';
import { FieldRule, validateForm, firstError, LIMITS } from '@/utils/validation';
import { toTitleCase } from '@/utils/format';

/** The same rules as the create form and the API. */
const RULES: Record<string, FieldRule> = {
  title: { label: 'job title', required: true, minLength: LIMITS.name.min, maxLength: LIMITS.title.max },
  employerName: { label: 'employer name', maxLength: LIMITS.title.max },
  location: { label: 'location', maxLength: LIMITS.shortText.max },
  salaryRange: { label: 'salary range', maxLength: 100 },
  description: { label: 'description', maxLength: LIMITS.longText.max },
};

export default function VacancyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vacancy, setVacancy] = useState<JobVacancy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
        console.error("Couldn't load vacancy:", error);
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

  // Save had no in-flight guard: a second click while the first request was
  // still open fired the same update again.
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || saving) return;

    // Inline edit had no checks at all; these are the create form's rules.
    const problems = validateForm(formData, RULES);
    if (Object.keys(problems).length > 0) {
      toast.error(firstError(problems));
      return;
    }
    setSaving(true);

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
      toast.success('Vacancy updated');
    } catch (error) {
      toast.error("Couldn't update vacancy. Please try again.");
      console.error("Couldn't update vacancy:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!vacancy) return;
    try {
      setDeleting(true);
      await employmentService.deleteVacancy(vacancy.id);
      toast.success('Vacancy deleted');
      navigate('/employment/vacancies');
    } catch (error) {
      toast.error("Couldn't delete vacancy. Please try again.");
      console.error("Couldn't delete vacancy:", error);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return <Card className="p-5 text-center">Loading vacancy details...</Card>;
  }

  if (!vacancy) {
    return (
      <Card className="p-5 text-center text-gray-500">
        <p>Vacancy not found</p>
      </Card>
    );
  }

  const employerName =
    vacancy.employerId && typeof vacancy.employerId === 'object'
      ? vacancy.employerId.name
      : vacancy.employerName || 'One-off post';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => navigate('/employment/vacancies')}
            className="p-2 hover:bg-gray-100 rounded text-lg"
          >
            ←
          </button>
          <PageHeader title={toTitleCase(vacancy.title)} />
        </div>
        <div className="flex gap-2 items-center">
          {!isEditing && (
            <>
              <Button onClick={() => setIsEditing(true)} className="bg-blue-600 text-white" icon={<FiEdit2 />} collapseLabel>Edit</Button>
              <Button onClick={() => setShowDeleteConfirm(true)} className="bg-red-600 text-white" icon={<FiTrash2 />} collapseLabel>Delete</Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="text-xs text-gray-600">Employer</div>
          <div className="font-semibold text-gray-900">{toTitleCase(employerName)}</div>
        </Card>
        <Card>
          <div className="text-xs text-gray-600">Location</div>
          <div className="font-semibold text-gray-900">{vacancy.location ? toTitleCase(vacancy.location) : '—'}</div>
        </Card>
        <Card>
          <div className="text-xs text-gray-600">Salary Range</div>
          <div className="font-semibold text-gray-900">{vacancy.salaryRange || '—'}</div>
        </Card>
      </div>

      <Card>
        {isEditing ? (
          <form onSubmit={handleSave} className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-900 mb-2">Job Title</label>
                <input
                  aria-label="Job Title"
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
                  aria-label="Location"
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
                  aria-label="Salary Range"
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
                  aria-label="Status"
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
                aria-label="Required Skills"
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
                aria-label="Description"
                name="description"
                value={formData.description || ''}
                onChange={handleChange}
                rows={4}
                className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-3">
              <Button onClick={() => setIsEditing(false)} className="bg-gray-200 text-gray-800">
                Cancel
              </Button>
              <Button type="submit" className="bg-blue-600 text-white" isLoading={saving} disabled={saving}>
                Save Changes
              </Button>
            </div>
          </form>
        ) : (
          <div className="p-4 space-y-4">
            <div>
              <h3 className="font-semibold mb-2 text-foreground">Description</h3>
              <p className="text-gray-700 whitespace-pre-wrap">
                {vacancy.description || 'No description provided'}
              </p>
            </div>

            {vacancy.skillsRequired && vacancy.skillsRequired.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2 text-foreground">Required Skills</h3>
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
