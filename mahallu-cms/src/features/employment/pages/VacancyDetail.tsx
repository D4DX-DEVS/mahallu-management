import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { employmentService, type JobVacancy } from '@/services/employmentService';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Avatar from '@/components/ui/Avatar';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import { FiHome, FiMapPin, FiDollarSign } from 'react-icons/fi';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

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
      toast.success('Vacancy updated');
    } catch (error) {
      toast.error(getFriendlyError(error, "Couldn't update vacancy. Try again in a moment."));
      console.error('Failed to update vacancy:', error);
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
      toast.error(getFriendlyError(error, "Couldn't delete vacancy. Try again in a moment."));
      console.error('Failed to delete vacancy:', error);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Card className="flex justify-center py-12">
        <LoadingSpinner />
      </Card>
    );
  }

  if (!vacancy) {
    return (
      <Card>
        <EmptyState title="Vacancy not found" description="This vacancy may have been removed." />
      </Card>
    );
  }

  const employerName =
    vacancy.employerId && typeof vacancy.employerId === 'object'
      ? vacancy.employerId.name
      : vacancy.employerName || 'One-off post';

  return (
    <div className="space-y-4">
      <PageHeader
        title={vacancy.title}
        leading={<Avatar name={vacancy.title} size={56} />}
        description="Job vacancy details"
        actions={
          !isEditing && (
            <>
              <Button variant="secondary" onClick={() => navigate('/employment/vacancies')}>
                Back
              </Button>
              <Button onClick={() => setIsEditing(true)}>Edit</Button>
              <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
                Delete
              </Button>
            </>
          )
        }
      />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard variant="inline" title="Employer" value={employerName} icon={<FiHome className="h-[17px] w-[17px]" />} tone="green" />
        <StatCard variant="inline" title="Location" value={vacancy.location || '—'} icon={<FiMapPin className="h-[17px] w-[17px]" />} tone="lime" />
        <StatCard variant="inline" title="Salary Range" value={vacancy.salaryRange || '—'} icon={<FiDollarSign className="h-[17px] w-[17px]" />} tone="neutral" />
      </div>

      <Card padding="none">
        {isEditing ? (
          <form onSubmit={handleSave} className="space-y-5 p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <Input label="Job Title" type="text" name="title" value={formData.title || ''} onChange={handleChange} />
              </div>

              <div>
                <Input label="Location" type="text" name="location" value={formData.location || ''} onChange={handleChange} />
              </div>

              <div>
                <Input label="Salary Range" type="text" name="salaryRange" value={formData.salaryRange || ''} onChange={handleChange} />
              </div>

              <div>
                <label className={labelClasses}>Status</label>
                <select
                  name="status"
                  value={formData.status || 'open'}
                  onChange={handleChange}
                  className={`${controlClasses} h-9`}
                >
                  <option value="open">Open</option>
                  <option value="filled">Filled</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
            </div>

            <div>
              <Input label="Required Skills" type="text" name="skillsRequired" value={ Array.isArray(formData.skillsRequired) ? formData.skillsRequired.join(', ') : formData.skillsRequired || '' } onChange={handleChange} />
            </div>

            <div>
              <label className={labelClasses}>Description</label>
              <textarea
                name="description"
                value={formData.description || ''}
                onChange={handleChange}
                rows={4}
                className={`${controlClasses} py-2`}
              />
            </div>

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="secondary" onClick={() => setIsEditing(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Save Changes
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-5 p-5">
            <div>
              <h3 className="mb-2 text-sm font-bold text-[#18231E] dark:text-surface-text">Description</h3>
              <p className="whitespace-pre-wrap text-[13px] text-[#3A4741] dark:text-surface-text">{vacancy.description || 'No description provided'}</p>
            </div>

            {vacancy.skillsRequired && vacancy.skillsRequired.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-bold text-[#18231E] dark:text-surface-text">Required Skills</h3>
                <div className="flex flex-wrap gap-2">
                  {vacancy.skillsRequired.map((skill, idx) => (
                    <span key={idx} className="rounded-full bg-mint px-2.5 py-0.5 text-xs font-semibold text-primary-700 dark:bg-brand-lime/15 dark:text-brand-lime">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="text-xs text-[#7B8983] dark:text-surface-muted">
              Posted on {new Date(vacancy.postedDate).toLocaleDateString()}
            </div>
          </div>
        )}
      </Card>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete job vacancy?"
        message="This job vacancy will be deleted. This cannot be undone."
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
