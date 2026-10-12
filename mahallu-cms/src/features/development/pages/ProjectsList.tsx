import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import Select from '@/components/ui/Select';
import Badge, { BadgeVariant } from '@/components/ui/Badge';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { developmentService, DevelopmentProject } from '@/services/developmentService';
import Avatar from '@/components/ui/Avatar';

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

const PROJECT_STATUSES = [
  { value: 'proposed', label: 'Proposed' },
  { value: 'approved', label: 'Approved' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'dropped', label: 'Dropped' },
];

export default function ProjectsList() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<DevelopmentProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, [currentPage, search, selectedArea, selectedStatus]);

  const loadProjects = async () => {
    setLoading(true);
    try {
      const { data, pagination } = await developmentService.getProjects({
        page: currentPage,
        limit: itemsPerPage,
        search: search || undefined,
        area: selectedArea || undefined,
        status: selectedStatus || undefined,
      });
      setProjects(data);
      if (pagination) {
        setTotalPages(pagination.totalPages);
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await developmentService.deleteProject(deleteId);
      toast.success('Project deleted');
      setConfirmDelete(false);
      setDeleteId(null);
      loadProjects();
    } catch (error) {
      toast.error(getFriendlyError(error, "Couldn't delete project. Try again in a moment."));
      setConfirmDelete(false);
      setDeleteId(null);
    }
  };

  const areaTone = (area: string): BadgeVariant => {
    const tones: Record<string, BadgeVariant> = {
      roads: 'info',
      water: 'info',
      sanitation: 'success',
      environment: 'success',
      education: 'primary',
      healthcare: 'danger',
      public_facility: 'warning',
      govt_scheme: 'warning',
      infrastructure: 'info',
      other: 'neutral',
    };
    return tones[area] || 'neutral';
  };

  const statusTone = (status: string): BadgeVariant => {
    const tones: Record<string, BadgeVariant> = {
      proposed: 'neutral',
      approved: 'info',
      in_progress: 'warning',
      completed: 'success',
      dropped: 'danger',
    };
    return tones[status] || 'neutral';
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Community development projects"
        description="Track proposed, ongoing and completed local projects"
        actions={<Button onClick={() => navigate('/development/create')}>+ Create project</Button>}
      />

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{
            value: search,
            onChange: (value) => {
              setSearch(value);
              setCurrentPage(1);
            },
            placeholder: 'Search projects',
          }}
        >
          <div className="w-44">
            <Select
              aria-label="Filter by area"
              options={[{ value: '', label: 'All Areas' }, ...PROJECT_AREAS]}
              value={selectedArea}
              onChange={(e) => {
                setSelectedArea(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="w-44">
            <Select
              aria-label="Filter by status"
              options={[{ value: '', label: 'All Statuses' }, ...PROJECT_STATUSES.map(({ value, label }) => ({ value, label }))]}
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </FilterBar>
      </Card>

      {/* Projects Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <EmptyState title="No projects found" description="Create a project or adjust the filters." />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {projects.map((project) => (
              <Card
                key={project.id}
                onClick={() => navigate(`/development/${project.id}`)}
                hoverEffect
                className="cursor-pointer"
              >
                <div className="p-4">
                  <div className="flex items-center gap-2.5"><Avatar name={project.name} size={32} /><h3 className="truncate text-sm font-bold text-[#18231E] dark:text-surface-text">{project.name}</h3></div>

                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Badge variant={areaTone(project.area)}>
                      {PROJECT_AREAS.find((a) => a.value === project.area)?.label}
                    </Badge>
                    <StatusBadge
                      status={project.status}
                      tone={statusTone(project.status)}
                      label={PROJECT_STATUSES.find((s) => s.value === project.status)?.label}
                    />
                  </div>

                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-[#5B6963] dark:text-surface-muted">
                      <span>Progress</span>
                      <span className="font-bold text-primary-700 dark:text-brand-lime">{project.progressPercent}%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-md bg-[#E7EEEA] dark:bg-surface-raised">
                      <div
                        className="h-1.5 rounded-md bg-progress-brand"
                        style={{ width: `${project.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-[#5B6963] dark:text-surface-muted">
                    <div>Est. Cost: ₹{(project.estimatedCost || 0).toLocaleString()}</div>
                  </div>

                  <div className="mt-3 flex gap-2">
                    <Button
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/development/${project.id}`);
                      }}
                      className="flex-1"
                    >
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteId(project.id);
                        setConfirmDelete(true);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          <div className="mt-1">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={projects.length * totalPages}
              itemsPerPage={itemsPerPage}
              onPageChange={setCurrentPage}
            />
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete project?"
        message="Delete this project? This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => {
          setConfirmDelete(false);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
