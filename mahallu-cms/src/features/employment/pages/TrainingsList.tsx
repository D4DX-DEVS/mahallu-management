import { useEffect, useState, useCallback } from 'react';
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { employmentService, type SkillTraining, type EmploymentSummary } from '@/services/employmentService';
import Button from '@/components/ui/Button';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import Tabs from '@/components/ui/Tabs';
import EmptyState from '@/components/ui/EmptyState';
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
import { loadErrorMessage } from '@/utils/errors';

export default function TrainingsList() {
  const navigate = useNavigate();
  const [trainings, setTrainings] = useState<SkillTraining[]>([]);
  const [summary, setSummary] = useState<EmploymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [error, setError] = useState<string | null>(null);
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

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
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
      setTotalItems(trainResult.pagination?.total ?? trainResult.data.length);
    } catch (err) {
      setError(loadErrorMessage(err, 'trainings'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
      label: 'Training',
      sortable: true,
      width: '16rem',
      render: (_v, training) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{toTitleCase(training.name)}</div>
          <div className="truncate text-xs text-muted-foreground">
            {training.trainerName ? toTitleCase(training.trainerName) : 'No trainer'}
          </div>
        </div>
      ),
    },
    {
      key: 'startDate',
      label: 'Duration',
      sortable: true,
      priority: 'secondary',
      width: '14rem',
      render: (_v, training) =>
        new Date(training.startDate).toLocaleDateString() + ' – ' + new Date(training.endDate).toLocaleDateString(),
    },
    { key: 'status', label: 'Status', sortable: true, width: '8rem', render: (_v, training) => <StatusBadge status={training.status} /> },
    {
      key: 'participants',
      label: 'Participants',
      align: 'center',
      sortable: false,
      priority: 'secondary',
      width: '9rem',
      render: (_v, training) => <span className="tabular-nums">{training.participantCount || training.participants?.length || 0}</span>,
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      sortable: false,
      width: '6.5rem',
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

  const isFiltered = Boolean(debouncedSearch || statusFilter);

  return (
    <>
      <PageHeader
        title="Training programmes"
        description="Skills training run for the community."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => navigate('/employment/trainings/create')}>
            New training
          </Button>
        }
      />

      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="Total trainings" value={summary.trainingsCount} tone="info" />
          <StatCard title="Skilled workers" value={summary.skilledWorkers} tone="success" />
          <StatCard title="Job seekers" value={summary.registeredJobSeekers} tone="info" />
          <StatCard title="Employers" value={summary.employersCount} tone="warning" />
        </div>
      )}

      <TableCard>
        <TableToolbar
          tabs={
            <Tabs
              variant="segmented"
              ariaLabel="Training status"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}
              items={[
                { value: '', label: 'All' },
                { value: 'planned', label: 'Planned' },
                { value: 'ongoing', label: 'Ongoing' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
          }
          searchQuery={search}
          onSearchChange={(value) => {
            setSearch(value);
            setCurrentPage(1);
          }}
          searchEntity="training programmes"
          onRefresh={fetchData}
        />

        {error ? (
          <EmptyState variant="error" entity="trainings" description={error} action={{ label: 'Try again', onClick: fetchData }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={trainings}
              isLoading={loading}
              entity="trainings"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearch(''); setStatusFilter(''); setCurrentPage(1); } }
                  : { label: 'Add training', onClick: () => navigate('/employment/trainings/create') }
              }
              rowKey={(training) => training.id}
              onRowClick={(training) => navigate(`/employment/trainings/${training.id}`)}
            />

            <div className="mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                entity="trainings"
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
        isOpen={showDeleteConfirm}
        title="Delete this training?"
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
    </>
  );
}
