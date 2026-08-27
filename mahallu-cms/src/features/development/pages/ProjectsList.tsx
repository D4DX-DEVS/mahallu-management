import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
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

const PROJECT_STATUSES = [
  { value: 'proposed', label: 'Proposed', color: 'bg-gray-100' },
  { value: 'approved', label: 'Approved', color: 'bg-blue-100' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-100' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100' },
  { value: 'dropped', label: 'Dropped', color: 'bg-red-100' },
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
      toast.error('Failed to delete project');
      setConfirmDelete(false);
      setDeleteId(null);
    }
  };

  const getAreaBadgeColor = (area: string) => {
    const colors: Record<string, string> = {
      roads: 'bg-blue-100 text-blue-800',
      water: 'bg-cyan-100 text-cyan-800',
      sanitation: 'bg-green-100 text-green-800',
      environment: 'bg-emerald-100 text-emerald-800',
      education: 'bg-purple-100 text-purple-800',
      healthcare: 'bg-red-100 text-red-800',
      public_facility: 'bg-orange-100 text-orange-800',
      govt_scheme: 'bg-yellow-100 text-yellow-800',
      infrastructure: 'bg-indigo-100 text-indigo-800',
      other: 'bg-gray-100 text-gray-800',
    };
    return colors[area] || 'bg-gray-100 text-gray-800';
  };

  const getStatusBadgeColor = (status: string) => {
    const colors: Record<string, string> = {
      proposed: 'bg-gray-100 text-gray-800',
      approved: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      dropped: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Community Development Projects</h1>
        <Button onClick={() => navigate('/development/create')}>Create Project</Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <input
          type="text"
          placeholder="Search projects..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setCurrentPage(1);
          }}
          className="px-3 py-2 border rounded text-sm"
        />
        <select
          value={selectedArea}
          onChange={(e) => {
            setSelectedArea(e.target.value);
            setCurrentPage(1);
          }}
          className="px-3 py-2 border rounded text-sm"
        >
          <option value="">All Areas</option>
          {PROJECT_AREAS.map((area) => (
            <option key={area.value} value={area.value}>
              {area.label}
            </option>
          ))}
        </select>
        <select
          value={selectedStatus}
          onChange={(e) => {
            setSelectedStatus(e.target.value);
            setCurrentPage(1);
          }}
          className="px-3 py-2 border rounded text-sm"
        >
          <option value="">All Statuses</option>
          {PROJECT_STATUSES.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-8 text-gray-500">No projects found</div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {projects.map((project) => (
              <Card
                key={project.id}
                onClick={() => navigate(`/development/${project.id}`)}
                className="cursor-pointer hover:shadow-lg transition"
              >
                <div className="p-4">
                  <h3 className="font-semibold text-sm sm:text-base truncate">{project.name}</h3>

                  <div className="flex gap-2 mt-2 flex-wrap">
                    <span className={`text-xs px-2 py-1 rounded ${getAreaBadgeColor(project.area)}`}>
                      {PROJECT_AREAS.find((a) => a.value === project.area)?.label}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${getStatusBadgeColor(project.status)}`}>
                      {PROJECT_STATUSES.find((s) => s.value === project.status)?.label}
                    </span>
                  </div>

                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Progress</span>
                      <span>{project.progressPercent}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full"
                        style={{ width: `${project.progressPercent}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-gray-600">
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

          <div className="mt-6">
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
        title="Delete Project"
        message="Delete this project? This action cannot be undone."
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
