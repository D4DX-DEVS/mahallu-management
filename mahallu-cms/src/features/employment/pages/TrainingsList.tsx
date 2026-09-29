import { useEffect, useState, useCallback } from 'react';
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { employmentService, type SkillTraining, type EmploymentSummary } from '@/services/employmentService';
import Button from '@/components/ui/Button';
import ExpandableSearch from '@/components/ui/ExpandableSearch';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import ActionsMenu from '@/components/ui/ActionsMenu';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';
import { TableColumn } from '@/types';
import { toTitleCase } from '@/utils/format';

export default function TrainingsList() {
  const navigate = useNavigate();
  const [trainings, setTrainings] = useState<SkillTraining[]>([]);
  const [summary, setSummary] = useState<EmploymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch trainings
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [trainResult, sumResult] = await Promise.all([
          employmentService.getTrainings({
            page: currentPage,
            limit: itemsPerPage,
            search: debouncedSearch,
            status: statusFilter || undefined,
          }),
          employmentService.getSummary(),
        ]);
        setTrainings(trainResult.data);
        setSummary(sumResult);
        setTotalPages(trainResult.pagination?.totalPages || 1);
      } catch (error) {
        console.error("Couldn't load trainings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentPage, itemsPerPage, debouncedSearch, statusFilter]);

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteId) return;
    try {
      setDeleting(true);
      await employmentService.deleteTraining(deleteId);
      setTrainings((prev) => prev.filter((t) => t.id !== deleteId));
      toast.success('Training deleted');
      setShowDeleteConfirm(false);
      setDeleteId(null);
    } catch (error) {
      toast.error("Couldn't delete training. Please try again.");
      console.error("Couldn't delete training:", error);
    } finally {
      setDeleting(false);
    }
  }, [deleteId]);

  const columns: TableColumn<SkillTraining>[] = [
    {
      key: 'name',
      label: 'Training Name',
      render: (_v, training) => (
        <div>
          <div className="font-medium text-foreground">{toTitleCase(training.name)}</div>
          <div className="text-xs text-muted-foreground">
            {training.trainerName ? toTitleCase(training.trainerName) : 'No trainer'}
          </div>
        </div>
      ),
    },
    {
      key: 'startDate',
      label: 'Duration',
      priority: 'secondary',
      render: (_v, training) =>
        new Date(training.startDate).toLocaleDateString() + ' - ' + new Date(training.endDate).toLocaleDateString(),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_v, training) => <StatusBadge status={training.status} />,
    },
    {
      key: 'participants',
      label: 'Participants',
      align: 'center',
      priority: 'secondary',
      render: (_v, training) => training.participantCount || training.participants?.length || 0,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      sortable: false,
      render: (_v, training) => (
        <ActionsMenu
          label={'Actions for ' + training.name}
          items={[
            {
              label: 'Edit',
              icon: <FiEdit2 className="h-4 w-4" />,
              onClick: () => navigate(`/employment/trainings/${training.id}`),
            },
            {
              label: 'Delete',
              icon: <FiTrash2 className="h-4 w-4" />,
              onClick: () => handleDeleteClick(training.id),
              variant: 'danger' as const,
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Training programmes"
        description="Skills training run for the community."
        breadcrumbs={[{ label: 'Employment' }]}
      />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <ExpandableSearch
            value={search}
            onChange={(value) => {
              setSearch(value);
              setCurrentPage(1);
            }}
            entity="training programmes"
            placeholder="Search by training name"
          />
          <Button onClick={() => navigate('/employment/trainings/create')} icon={<FiPlus />} collapseLabel>
            New Training
          </Button>
        </div>
        <div className="flex gap-2 flex-wrap">
          {['', 'planned', 'ongoing', 'completed', 'cancelled'].map((status) => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status);
                setCurrentPage(1);
              }}
              className={`px-3 py-1 text-xs rounded-full ${
                statusFilter === status
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status || 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Total Trainings" value={summary.trainingsCount} tone="info" />
          <StatCard title="Skilled Workers" value={summary.skilledWorkers} tone="success" />
          <StatCard title="Job Seekers" value={summary.registeredJobSeekers} tone="info" />
          <StatCard title="Employers" value={summary.employersCount} tone="warning" />
        </div>
      )}

      <Table
        columns={columns}
        data={trainings}
        isLoading={loading}
        entity="skill trainings"
        rowKey={(training) => training.id}
      />

      {!loading && trainings.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={trainings.length * totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Training"
        message="Are you sure you want to delete this skill training?"
        consequence="The training record and participant list will be permanently removed."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
