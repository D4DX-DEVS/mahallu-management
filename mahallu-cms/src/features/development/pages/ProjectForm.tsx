import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { toast } from '@/store/toastStore';
import { developmentService, DevelopmentProject } from '@/services/developmentService';

const PROJECT_AREAS = [
  { value: 'roads', label: 'Roads' },
  { value: 'water', label: 'Water' },
  { value: 'sanitation', label: 'Sanitation' },
  { value: 'environment', label: 'Environment' },
  { value: 'education', label: 'Education' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'public_facility', label: 'Public Facility' },
  { value: 'govt_scheme', label: 'Govt Scheme' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'other', label: 'Other' },
];

interface ProjectFormProps {
  isEdit?: boolean;
}

export default function ProjectForm({ isEdit = false }: ProjectFormProps) {
  const navigate = useNavigate();
  const { id } = useParams();
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<Partial<DevelopmentProject>>({
    name: '',
    nameMl: '',
    area: 'roads',
    estimatedCost: 0,
    progressPercent: 0,
    status: 'proposed',
  });

  useEffect(() => {
    if (isEdit && id) {
      loadProject();
    }
  }, [id, isEdit]);

  const loadProject = async () => {
    try {
      const project = await developmentService.getProject(id!);
      setFormData(project);
    } catch (error) {
      console.error('Failed to load project:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit && id) {
        await developmentService.updateProject(id, formData);
        toast.success('Project updated');
      } else {
        await developmentService.createProject(formData);
        toast.success('Project created');
      }
      navigate('/development');
    } catch (error) {
      console.error('Failed to save project:', error);
      toast.error((error as any).response?.data?.message || 'Failed to save project');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">{isEdit ? 'Edit Project' : 'Create Project'}</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Project Name *</label>
            <input
              type="text"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Malayalam Name</label>
            <input
              type="text"
              value={formData.nameMl || ''}
              onChange={(e) => setFormData({ ...formData, nameMl: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Area *</label>
            <select
              value={formData.area || 'roads'}
              onChange={(e) => setFormData({ ...formData, area: e.target.value as any })}
              className="w-full px-3 py-2 border rounded"
            >
              {PROJECT_AREAS.map((area) => (
                <option key={area.value} value={area.value}>
                  {area.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Estimated Cost (₹) *</label>
            <input
              type="number"
              value={formData.estimatedCost || 0}
              onChange={(e) => setFormData({ ...formData, estimatedCost: parseFloat(e.target.value) })}
              required
              min="0"
              className="w-full px-3 py-2 border rounded"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Proposal</label>
          <textarea
            value={formData.proposal || ''}
            onChange={(e) => setFormData({ ...formData, proposal: e.target.value })}
            className="w-full px-3 py-2 border rounded"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Funding Source</label>
            <input
              type="text"
              value={formData.fundingSource || ''}
              onChange={(e) => setFormData({ ...formData, fundingSource: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Responsible Team</label>
            <input
              type="text"
              value={formData.responsibleTeam || ''}
              onChange={(e) => setFormData({ ...formData, responsibleTeam: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input
              type="date"
              value={formData.startDate ? formData.startDate.split('T')[0] : ''}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Target Date</label>
            <input
              type="date"
              value={formData.targetDate ? formData.targetDate.split('T')[0] : ''}
              onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
              className="w-full px-3 py-2 border rounded"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Progress Percent (0-100)</label>
            <input
              type="number"
              value={formData.progressPercent || 0}
              onChange={(e) =>
                setFormData({ ...formData, progressPercent: Math.min(100, Math.max(0, parseFloat(e.target.value))) })
              }
              min="0"
              max="100"
              className="w-full px-3 py-2 border rounded"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={formData.status || 'proposed'}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-3 py-2 border rounded"
            >
              <option value="proposed">Proposed</option>
              <option value="approved">Approved</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="dropped">Dropped</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Completion Report</label>
          <textarea
            value={formData.completionReport || ''}
            onChange={(e) => setFormData({ ...formData, completionReport: e.target.value })}
            className="w-full px-3 py-2 border rounded"
            rows={3}
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate('/development')}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
