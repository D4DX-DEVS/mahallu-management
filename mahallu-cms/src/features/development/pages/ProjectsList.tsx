import { useEffect, useState } from 'react';
import { FiEye, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import FilterPanel from '@/components/ui/FilterPanel';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import ActionsMenu from '@/components/ui/ActionsMenu';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { TableColumn } from '@/types';
import { developmentService, DevelopmentProject } from '@/services/developmentService';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import StatusBadge from '@/components/ui/StatusBadge';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedArea, setSelectedArea] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    loadProjects();
  }, [currentPage, itemsPerPage, search, selectedArea, selectedStatus]);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
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
        setTotalItems(pagination.total);
      }
    } catch (error) {
      console.error("Couldn't load projects:", error);
      setError(loadErrorMessage(error, 'projects'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setIsDeleting(true);
      await developmentService.deleteProject(deleteId);
      toast.success('Project deleted');
      setConfirmDelete(false);
      setDeleteId(null);
      loadProjects();
    } catch (error) {
      toast.error(errorMessage(error, { action: 'delete project' }));
      setConfirmDelete(false);
      setDeleteId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const getAreaBadgeColor = (area: string) => {
    const colors: Record<string, string> = {
      roads: 'bg-blue-100 text-blue-800',
      water: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-500/15 dark:text-cyan-300',
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

  const columns: TableColumn<DevelopmentProject>[] = [
    {
      key: 'name',
      label: 'Project',
      sortable: true,
      width: '16rem',
      render: (name) => <span className="font-medium text-foreground">{toTitleCase(name)}</span>,
    },
    {
      key: 'area',
      label: 'Area',
      sortable: true,
      width: '10rem',
      render: (area) => (
        <span className={`inline-flex rounded-sm px-2 py-0.5 text-xs font-medium ${getAreaBadgeColor(area)}`}>
          {PROJECT_AREAS.find((a) => a.value === area)?.label ?? '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      width: '8rem',
      render: (status) => (
        <StatusBadge status={status} label={PROJECT_STATUSES.find((s) => s.value === status)?.label} />
      ),
    },
    {
      key: 'progressPercent',
      label: 'Progress',
      sortable: true,
      priority: 'secondary',
      width: '10rem',
      render: (percent) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 flex-shrink-0 overflow-hidden rounded-full bg-subtle">
            <div className="h-full rounded-full bg-primary" style={{ width: `${percent || 0}%` }} />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">{percent || 0}%</span>
        </div>
      ),
    },
    {
      key: 'estimatedCost',
      label: 'Est. cost',
      align: 'right',
      sortable: true,
      priority: 'secondary',
      width: '9rem',
      render: (cost) => <span className="tabular-nums">₹{(cost || 0).toLocaleString('en-IN')}</span>,
    },
    {
      key: 'actions',
      label: '',
      width: '6.5rem',
      align: 'right',
      sortable: false,
      render: (_, row) => (
        <ActionsMenu
          label={`Actions for ${toTitleCase(row.name)}`}
          items={[
            { label: 'View', icon: <FiEye className="h-4 w-4" />, onClick: () => navigate(`/development/${row.id}`) },
            {
              label: 'Delete',
              icon: <FiTrash2 className="h-4 w-4" />,
              variant: 'danger',
              onClick: () => {
                setDeleteId(row.id);
                setConfirmDelete(true);
              },
            },
          ]}
        />
      ),
    },
  ];

  const activeFilterCount = (selectedArea ? 1 : 0) + (selectedStatus ? 1 : 0);
  const isFiltered = Boolean(search) || activeFilterCount > 0;
  const clearFilters = () => {
    setSelectedArea('');
    setSelectedStatus('');
    setCurrentPage(1);
  };

  return (
    <>
      <PageHeader
        title="Development projects"
        description="Community development projects and their progress."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => navigate('/development/create')}>
            New project
          </Button>
        }
      />

      <TableCard>
        <TableToolbar
          searchQuery={search}
          onSearchChange={(value) => {
            setSearch(value);
            setCurrentPage(1);
          }}
          searchEntity="projects"
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={activeFilterCount}
          onRefresh={loadProjects}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-52">
              <Select
                label="Area"
                options={[{ value: '', label: 'All areas' }, ...PROJECT_AREAS]}
                value={selectedArea}
                onChange={(e) => {
                  setSelectedArea(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="w-full sm:w-52">
              <Select
                label="Status"
                options={[{ value: '', label: 'All statuses' }, ...PROJECT_STATUSES.map(({ value, label }) => ({ value, label }))]}
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </FilterPanel>
        )}

        {error ? (
          <EmptyState variant="error" entity="projects" description={error} action={{ label: 'Try again', onClick: loadProjects }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={projects}
              isLoading={loading}
              entity="projects"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearch(''); clearFilters(); } }
                  : { label: 'Add project', onClick: () => navigate('/development/create') }
              }
              onRowClick={(row) => navigate(`/development/${row.id}`)}
            />

            <div className="mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                entity="projects"
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(size) => {
                  setItemsPerPage(size);
                  setCurrentPage(1);
                }}
              />
            </div>
          </>
        )}
      </TableCard>

      <ConfirmDialog
        isLoading={isDeleting}
        isOpen={confirmDelete}
        title="Delete this project?"
        message="This permanently removes the project and cannot be undone."
        confirmLabel="Delete project"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => {
          setConfirmDelete(false);
          setDeleteId(null);
        }}
      />
    </>
  );
}
