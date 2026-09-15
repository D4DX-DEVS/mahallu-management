import { useEffect, useState } from 'react';
import { FiArrowLeft, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { useParams, useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import { toast } from '@/store/toastStore';
import { developmentService, DevelopmentProject, ProjectExpenditure } from '@/services/developmentService';
import PageHeader from '@/components/layout/PageHeader';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';

const PROJECT_AREAS: Record<string, string> = {
  roads: 'Roads',
  water: 'Water',
  sanitation: 'Sanitation',
  environment: 'Environment',
  education: 'Education',
  healthcare: 'Healthcare',
  public_facility: 'Public Facility',
  govt_scheme: 'Govt Scheme',
  infrastructure: 'Infrastructure',
  other: 'Other',
};

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState<DevelopmentProject | null>(null);
  const [expenditure, setExpenditure] = useState<ProjectExpenditure | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [progressPercent, setProgressPercent] = useState(0);
  const [status, setStatus] = useState('proposed');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadData();
  }, [id, currentPage]);

  const loadData = async () => {
    if (!id) return;
    try {
      const projectData = await developmentService.getProject(id);
      setProject(projectData);
      setProgressPercent(projectData.progressPercent);
      setStatus(projectData.status);

      const expenditureData = await developmentService.getExpenditure(id, {
        page: currentPage,
        limit: 10,
      });
      setExpenditure(expenditureData);
    } catch (error) {
      console.error("Couldn't load project:", error);
      toast.error(loadErrorMessage(error, 'the project'));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setUpdating(true);
    try {
      await developmentService.updateProject(id, {
        progressPercent,
        status: status as 'proposed' | 'approved' | 'in_progress' | 'completed' | 'dropped',
      });
      setProject((prev) => (prev ? { ...prev, progressPercent, status: status as any } : null));
      toast.success('Project progress updated');
    } catch (error) {
      console.error("Couldn't update project:", error);
      toast.error(errorMessage(error, { action: 'update project progress' }));
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      setDeleting(true);
      await developmentService.deleteProject(id);
      toast.success('Project deleted');
      navigate('/development');
    } catch (error) {
      toast.error(errorMessage(error, { action: 'delete project' }));
      setDeleting(false);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (!project) return <div className="p-4">Project not found</div>;

  const areaLabel = PROJECT_AREAS[project.area] || project.area;

  return (
    <div>
      <div className="flex gap-2 justify-between items-center mb-4">
        <PageHeader title={toTitleCase(project.name)} />
        <div className="flex gap-2 items-center">
          <Button onClick={() => navigate(`/development/${id}/edit`)} icon={<FiEdit2 />} collapseLabel>Edit</Button>
          <Button variant="danger" onClick={() => setShowDeleteModal(true)} icon={<FiTrash2 />} collapseLabel>Delete</Button>
          <Button variant="secondary" onClick={() => navigate('/development')} icon={<FiArrowLeft />} collapseLabel>Back</Button>
        </div>
      </div>

      {/* Project Info Card */}
      <Card className="mb-4">
        <div>
          <h2 className="font-semibold mb-3">Project Information</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            {project.nameMl && (
              <div>
                <span className="text-gray-600">Malayalam Name</span>
                <div className="font-medium">{project.nameMl}</div>
              </div>
            )}
            <div>
              <span className="text-gray-600">Area</span>
              <div className="font-medium">{areaLabel}</div>
            </div>
            <div>
              <span className="text-gray-600">Status</span>
              <div className="font-medium capitalize">{project.status}</div>
            </div>
            <div>
              <span className="text-gray-600">Estimated Cost</span>
              <div className="font-medium">₹{(project.estimatedCost || 0).toLocaleString()}</div>
            </div>
            {project.fundingSource && (
              <div>
                <span className="text-gray-600">Funding Source</span>
                <div className="font-medium">{toTitleCase(project.fundingSource)}</div>
              </div>
            )}
            {project.responsibleTeam && (
              <div>
                <span className="text-gray-600">Responsible Team</span>
                <div className="font-medium">{toTitleCase(project.responsibleTeam)}</div>
              </div>
            )}
            {project.startDate && (
              <div>
                <span className="text-gray-600">Start Date</span>
                <div className="font-medium">{new Date(project.startDate).toLocaleDateString()}</div>
              </div>
            )}
            {project.targetDate && (
              <div>
                <span className="text-gray-600">Target Date</span>
                <div className="font-medium">{new Date(project.targetDate).toLocaleDateString()}</div>
              </div>
            )}
          </div>
          {project.proposal && (
            <div className="mt-4 pt-4 border-t">
              <span className="text-gray-600 text-sm">Proposal</span>
              <p className="mt-2 text-sm">{project.proposal}</p>
            </div>
          )}
          {project.completionReport && (
            <div className="mt-4 pt-4 border-t">
              <span className="text-gray-600 text-sm">Completion Report</span>
              <p className="mt-2 text-sm">{project.completionReport}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Progress Update Form */}
      <Card className="mb-4">
        <div>
          <h2 className="font-semibold mb-3">Update Progress</h2>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Progress Percent</label>
              <div className="flex items-center gap-4">
                <input
                  aria-label="Progress Percent"
                  type="range"
                  min="0"
                  max="100"
                  value={progressPercent}
                  onChange={(e) => setProgressPercent(parseInt(e.target.value))}
                  className="flex-1"
                />
                <span className="text-lg font-semibold w-16">{progressPercent}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Status</label>
              <select
                aria-label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full px-3 py-2 border rounded"
              >
                <option value="proposed">Proposed</option>
                <option value="approved">Approved</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="dropped">Dropped</option>
              </select>
            </div>

            <Button type="submit" disabled={updating}>
              {updating ? 'Updating...' : 'Update Progress'}
            </Button>
          </form>
        </div>
      </Card>

      {/* Expenditure Section */}
      <Card>
        <div>
          <h2 className="font-semibold mb-3">Project Expenditure</h2>
          {expenditure ? (
            <>
              <div className="mb-4 p-3 bg-blue-50 rounded">
                <div className="text-sm text-gray-600">Total Spent</div>
                <div className="text-2xl font-semibold tabular-nums">₹{expenditure.total.toLocaleString()}</div>
              </div>

              {expenditure.items.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No expenditure items linked to this project
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">Description</th>
                          <th className="px-3 py-2 text-left">Ledger</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {expenditure.items.map((item: any) => (
                          <tr key={item.id} className="border-t hover:bg-gray-50">
                            <td className="px-3 py-2">{new Date(item.date).toLocaleDateString()}</td>
                            <td className="px-3 py-2">{item.description}</td>
                            <td className="px-3 py-2">{item.ledgerId?.name ? toTitleCase(item.ledgerId.name) : '-'}</td>
                            <td className="px-3 py-2 text-right">₹{item.amount.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {expenditure.pagination && expenditure.pagination.totalPages > 1 && (
                    <div className="mt-4">
                      <Pagination
                        currentPage={currentPage}
                        totalPages={expenditure.pagination.totalPages}
                        totalItems={expenditure.pagination.total}
                        itemsPerPage={10}
                        onPageChange={setCurrentPage}
                      />
                    </div>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-500">Loading expenditure...</div>
          )}
        </div>
      </Card>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Project"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          Are you sure you want to delete <strong>{toTitleCase(project.name)}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
