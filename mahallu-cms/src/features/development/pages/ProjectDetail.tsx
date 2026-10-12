import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/ui/PageHeader';
import Tabs from '@/components/ui/Tabs';
import Badge from '@/components/ui/Badge';
import StatusBadge from '@/components/ui/StatusBadge';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { controlClasses, labelClasses } from '@/components/ui/Input';
import { TableColumn } from '@/types';
import { FiDollarSign } from 'react-icons/fi';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { developmentService, DevelopmentProject, ProjectExpenditure } from '@/services/developmentService';
import Avatar from '@/components/ui/Avatar';

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
  const [tab, setTab] = useState('overview');

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
      console.error('Failed to load project:', error);
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
      console.error('Failed to update project:', error);
      toast.error(getFriendlyError(error, "Couldn't update project progress. Try again in a moment."));
    } finally {
      setUpdating(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  if (!project) return <EmptyState title="Project not found" description="This project may have been removed." />;

  const areaLabel = PROJECT_AREAS[project.area] || project.area;

  const expenditureColumns: TableColumn<any>[] = [
    { key: 'date', label: 'Date', render: (v) => new Date(v).toLocaleDateString() },
    { key: 'description', label: 'Description' },
    { key: 'ledgerId', label: 'Ledger', render: (v) => (v?.name ? <StatusBadge status={v.name} tone="neutral" dot={false} /> : '-') },
    { key: 'amount', label: 'Amount', render: (v) => <span className="font-semibold text-[#B3261E] dark:text-red-300">{`₹${v.toLocaleString()}`}</span> },
  ];

  const infoLabel = 'text-[12px] font-bold uppercase tracking-[0.04em] text-[#7B8983] dark:text-surface-muted';
  const infoValue = 'mt-0.5 text-[13px] font-semibold text-[#18231E] dark:text-surface-text';

  return (
    <div className="space-y-4">
      <PageHeader
        leading={<Avatar size={56} name={project.name} />}
        title={project.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge variant="neutral">{areaLabel}</Badge>
            <StatusBadge status={project.status} />
          </span>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/development')}>
              Back
            </Button>
            <Button onClick={() => navigate(`/development/${id}/edit`)}>Edit</Button>
          </>
        }
      />

      <Tabs
        aria-label="Project sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'expenditure', label: 'Expenditure' },
        ]}
      />

      {tab === 'overview' && (
        <>
          {/* Project Info Card */}
          <Card>
            <h2 className="mb-3 text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">Project Information</h2>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div>
                <span className={infoLabel}>Area</span>
                <div className={infoValue}>{areaLabel}</div>
              </div>
              <div>
                <span className={infoLabel}>Status</span>
                <div className={infoValue}><StatusBadge status={project.status} /></div>
              </div>
              <div>
                <span className={infoLabel}>Estimated Cost</span>
                <div className={infoValue}>₹{(project.estimatedCost || 0).toLocaleString()}</div>
              </div>
              {project.fundingSource && (
                <div>
                  <span className={infoLabel}>Funding Source</span>
                  <div className={infoValue}>{project.fundingSource}</div>
                </div>
              )}
              {project.responsibleTeam && (
                <div>
                  <span className={infoLabel}>Responsible Team</span>
                  <div className={infoValue}>{project.responsibleTeam}</div>
                </div>
              )}
              {project.startDate && (
                <div>
                  <span className={infoLabel}>Start Date</span>
                  <div className={infoValue}>{new Date(project.startDate).toLocaleDateString()}</div>
                </div>
              )}
              {project.targetDate && (
                <div>
                  <span className={infoLabel}>Target Date</span>
                  <div className={infoValue}>{new Date(project.targetDate).toLocaleDateString()}</div>
                </div>
              )}
            </div>
            {project.proposal && (
              <div className="mt-4 border-t border-line pt-4 dark:border-surface-border">
                <span className={infoLabel}>Proposal</span>
                <p className="mt-1 text-[13px] text-[#3A4741] dark:text-surface-text">{project.proposal}</p>
              </div>
            )}
          </Card>

          {/* Progress Update Form */}
          <Card>
            <h2 className="mb-3 text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">Update Progress</h2>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label htmlFor="progress-percent" className={labelClasses}>Progress Percent</label>
                <div className="flex items-center gap-4">
                  <input
                    id="progress-percent"
                    type="range"
                    min="0"
                    max="100"
                    value={progressPercent}
                    onChange={(e) => setProgressPercent(parseInt(e.target.value))}
                    className="flex-1 accent-primary-700 dark:accent-brand-lime"
                  />
                  <span className="w-16 text-lg font-extrabold text-primary-700 dark:text-brand-lime">{progressPercent}%</span>
                </div>
                <div className="mt-2 h-2 w-full rounded-md bg-[#E7EEEA] dark:bg-surface-raised">
                  <div
                    className="h-2 rounded-md bg-progress-brand transition-all"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="project-status" className={labelClasses}>Status</label>
                <select
                  id="project-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={`${controlClasses} h-9`}
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
          </Card>
        </>
      )}

      {tab === 'expenditure' && (
        <>
          {/* Expenditure Section */}
          {expenditure ? (
            <>
              <StatCard
                variant="inline"
                title="Total Spent"
                value={`₹${expenditure.total.toLocaleString()}`}
                viz={(project?.estimatedCost || 0) > 0 ? { type: 'bullet', percent: Math.round((expenditure.total / (project?.estimatedCost || 1)) * 100), target: 100, color: expenditure.total > (project?.estimatedCost || 0) ? '#B3261E' : '#04563A' } : undefined}
                summary={`Spent ₹${expenditure.total.toLocaleString()} of ₹${(project?.estimatedCost || 0).toLocaleString()} estimated cost`}
                icon={<FiDollarSign className="h-[17px] w-[17px]" />}
                tone="green"
              />

              {expenditure.items.length === 0 ? (
                <Card>
                  <EmptyState title="No expenditure items" description="No expenditure items linked to this project" />
                </Card>
              ) : (
                <Card padding="none" className="overflow-hidden">
                  <div className="p-3.5">
                    <Table
                      columns={expenditureColumns}
                      data={expenditure.items}
                      emptyMessage="No expenditure items linked to this project"
                      showExport={false}
                    />

                    {expenditure.pagination && expenditure.pagination.totalPages > 1 && (
                      <div className="mt-3.5">
                        <Pagination
                          currentPage={currentPage}
                          totalPages={expenditure.pagination.totalPages}
                          totalItems={expenditure.pagination.total}
                          itemsPerPage={10}
                          onPageChange={setCurrentPage}
                        />
                      </div>
                    )}
                  </div>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <div className="flex items-center justify-center py-8">
                <LoadingSpinner />
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
