import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { employmentService, type SkillTraining, type EmploymentSummary } from '@/services/employmentService';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import Table from '@/components/ui/Table';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import Segmented from '@/components/ui/Segmented';
import StatusBadge from '@/components/ui/StatusBadge';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import StatCard from '@/components/ui/StatCard';
import { FiBookOpen, FiAward, FiUsers, FiHome } from 'react-icons/fi';
import { TableColumn } from '@/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

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
        console.error('Failed to fetch trainings:', error);
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
      toast.error(getFriendlyError(error, "Couldn't delete training. Try again in a moment."));
      console.error('Failed to delete training:', error);
    } finally {
      setDeleting(false);
    }
  }, [deleteId]);

  const columns: TableColumn<SkillTraining>[] = [
    {
      key: 'name',
      label: 'Training Name',
      render: (_, training) => (
        <PersonCell name={training.name} subtitle={training.trainerName || 'No trainer'} />
      ),
    },
    {
      key: 'duration',
      label: 'Duration',
      render: (_, training) => (
        <>
          {new Date(training.startDate).toLocaleDateString()} - {new Date(training.endDate).toLocaleDateString()}
        </>
      ),
    },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'participants',
      label: 'Participants',
      render: (_, training) => training.participantCount || training.participants?.length || 0,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, training) => (
        <RowActions
          onEdit={() => navigate(`/employment/trainings/${training.id}`)}
          onDelete={() => handleDeleteClick(training.id)}
          ariaLabels={{ edit: 'Edit training', delete: 'Delete training' }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Skill trainings"
        description="Plan trainings and track participants"
        actions={<Button onClick={() => navigate('/employment/trainings/create')}>+ New training</Button>}
      />

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard variant="inline" title="Total Trainings" value={summary.trainingsCount} icon={<FiBookOpen className="h-[17px] w-[17px]" />} tone="green" />
          <StatCard variant="inline" title="Skilled Workers" value={summary.skilledWorkers} icon={<FiAward className="h-[17px] w-[17px]" />} tone="lime" />
          <StatCard variant="inline" title="Job Seekers" value={summary.registeredJobSeekers} icon={<FiUsers className="h-[17px] w-[17px]" />} tone="neutral" />
          <StatCard variant="inline" title="Employers" value={summary.employersCount} icon={<FiHome className="h-[17px] w-[17px]" />} tone="gold" />
        </div>
      )}

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{
            value: search,
            onChange: (v) => {
              setSearch(v);
              setCurrentPage(1);
            },
            placeholder: 'Search by training name',
          }}
        >
          <Segmented
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setCurrentPage(1);
            }}
            options={[
              { value: '', label: 'All' },
              { value: 'planned', label: 'Planned' },
              { value: 'ongoing', label: 'Ongoing' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
        </FilterBar>

        <div className="p-3.5">
          <Table
            columns={columns}
            data={trainings}
            isLoading={loading}
            emptyMessage="No skill trainings found"
            showExport={false}
          />
          {!loading && trainings.length > 0 && (
            <div className="mt-3.5">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={trainings.length * totalPages}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete training?"
        message="This skill training will be deleted. This cannot be undone."
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
