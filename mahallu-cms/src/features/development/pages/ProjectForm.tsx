import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
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
      toast.error(getFriendlyError(error, "Couldn't save project. Check the details and try again."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader
        title={isEdit ? 'Edit project' : 'Create project'}
        description="Describe the project, its cost and who is responsible"
      />

      <form onSubmit={handleSubmit}>
        <Card className="space-y-5">
          <div>
            <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">Project details</h2>
            <p className="mb-3 text-xs text-[#7B8983] dark:text-surface-muted">Name, area and estimated cost</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Project Name"
                type="text"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
              <Input
                label="Malayalam Name"
                type="text"
                value={formData.nameMl || ''}
                onChange={(e) => setFormData({ ...formData, nameMl: e.target.value })}
              />
              <Select
                label="Area *"
                options={PROJECT_AREAS}
                value={formData.area || 'roads'}
                onChange={(e) => setFormData({ ...formData, area: e.target.value as any })}
              />
              <Input
                label="Estimated Cost (₹)"
                type="number"
                value={formData.estimatedCost || 0}
                onChange={(e) => setFormData({ ...formData, estimatedCost: parseFloat(e.target.value) })}
                required
                min="0"
              />
            </div>
            <div className="mt-4">
              <label htmlFor="project-proposal" className={labelClasses}>Proposal</label>
              <textarea
                id="project-proposal"
                value={formData.proposal || ''}
                onChange={(e) => setFormData({ ...formData, proposal: e.target.value })}
                className={`${controlClasses} py-2`}
                rows={3}
              />
            </div>
          </div>

          <div className="border-t border-line pt-5 dark:border-surface-border">
            <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">Funding and schedule</h2>
            <p className="mb-3 text-xs text-[#7B8983] dark:text-surface-muted">Who pays, who runs it and when</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Funding Source"
                type="text"
                value={formData.fundingSource || ''}
                onChange={(e) => setFormData({ ...formData, fundingSource: e.target.value })}
              />
              <Input
                label="Responsible Team"
                type="text"
                value={formData.responsibleTeam || ''}
                onChange={(e) => setFormData({ ...formData, responsibleTeam: e.target.value })}
              />
              <Input
                label="Start Date"
                type="date"
                value={formData.startDate ? formData.startDate.split('T')[0] : ''}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              />
              <Input
                label="Target Date"
                type="date"
                value={formData.targetDate ? formData.targetDate.split('T')[0] : ''}
                onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
              />
            </div>
          </div>

          <div className="border-t border-line pt-5 dark:border-surface-border">
            <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">Progress</h2>
            <p className="mb-3 text-xs text-[#7B8983] dark:text-surface-muted">Current status and completion</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Progress Percent (0-100)"
                type="number"
                value={formData.progressPercent || 0}
                onChange={(e) =>
                  setFormData({ ...formData, progressPercent: Math.min(100, Math.max(0, parseFloat(e.target.value))) })
                }
                min="0"
                max="100"
              />
              <Select
                label="Status"
                options={[
                  { value: 'proposed', label: 'Proposed' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'in_progress', label: 'In Progress' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'dropped', label: 'Dropped' },
                ]}
                value={formData.status || 'proposed'}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              />
            </div>
            <div className="mt-4">
              <label htmlFor="project-completion-report" className={labelClasses}>Completion Report</label>
              <textarea
                id="project-completion-report"
                value={formData.completionReport || ''}
                onChange={(e) => setFormData({ ...formData, completionReport: e.target.value })}
                className={`${controlClasses} py-2`}
                rows={3}
              />
            </div>
          </div>

          <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none rounded-b-card border-t border-line bg-white/90 px-4 py-3 backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button type="button" variant="secondary" onClick={() => navigate('/development')}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
