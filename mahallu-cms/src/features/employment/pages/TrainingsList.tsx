import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { employmentService, type SkillTraining, type EmploymentSummary } from '@/services/employmentService';
import Button from '@/components/ui/Button';
import ExpandableSearch from '@/components/ui/ExpandableSearch';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';
import SortableTh from '@/components/ui/SortableTh';
import { useSortableRows } from '@/hooks/useSortableRows';

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

  /* Duration reads as a date range, so it orders by when the training starts;
     Participants counts the list when the API has not sent a total. */
  const {
    rows: sortedTrainings,
    sort,
    toggleSort,
  } = useSortableRows(trainings, null, {
    participants: (row) => row.participantCount ?? row.participants?.length ?? 0,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Training programmes" description="Skills training run for the community." breadcrumbs={[{ label: 'Employment' }]} />
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex-1 space-y-2">
          <ExpandableSearch
            value={search}
            onChange={(value) => {
              setSearch(value);
              setCurrentPage(1);
            }}
            entity="training programmes"
            placeholder="Search by training name"
          />
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
        <Button onClick={() => navigate('/employment/trainings/create')} className="w-full sm:w-auto">
          + New Training
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <div className="py-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.trainingsCount}</div>
              <div className="text-xs sm:text-sm text-gray-600">Total Trainings</div>
            </div>
          </Card>
          <Card>
            <div className="py-4 text-center">
              <div className="text-2xl font-bold text-green-600">{summary.skilledWorkers}</div>
              <div className="text-xs sm:text-sm text-gray-600">Skilled Workers</div>
            </div>
          </Card>
          <Card>
            <div className="py-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{summary.registeredJobSeekers}</div>
              <div className="text-xs sm:text-sm text-gray-600">Job Seekers</div>
            </div>
          </Card>
          <Card>
            <div className="py-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{summary.employersCount}</div>
              <div className="text-xs sm:text-sm text-gray-600">Employers</div>
            </div>
          </Card>
        </div>
      )}

      {loading ? (
        <Card>
          <div className="py-8 text-center">Loading trainings...</div>
        </Card>
      ) : trainings.length === 0 ? (
        <Card>
          <div className="py-8 text-center text-gray-500">
            <p>No skill trainings found</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <SortableTh sortKey="name" sort={sort} onSort={toggleSort}>
                    Training Name
                  </SortableTh>
                  <SortableTh
                    sortKey="startDate"
                    sort={sort}
                    onSort={toggleSort}
                    responsiveClassName="hidden sm:table-cell"
                  >
                    Duration
                  </SortableTh>
                  <SortableTh sortKey="status" sort={sort} onSort={toggleSort}>
                    Status
                  </SortableTh>
                  <SortableTh sortKey="participants" sort={sort} onSort={toggleSort} align="center">
                    Participants
                  </SortableTh>
                  <th className="px-4 py-3 text-right text-label font-semibold text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedTrainings.map((training) => (
                  <tr key={training.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900">{training.name}</div>
                      <div className="text-xs text-gray-500">{training.trainerName || 'No trainer'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm hidden sm:table-cell text-gray-700">
                      {new Date(training.startDate).toLocaleDateString()} -{' '}
                      {new Date(training.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={training.status} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="text-sm text-gray-700">
                        {training.participantCount || training.participants?.length || 0}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => navigate(`/employment/trainings/${training.id}`)}
                        className="text-blue-600 hover:text-blue-900 px-2 py-1 text-xs hover:bg-blue-50 rounded"
                        title="View"
                        aria-label="View"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(training.id)}
                        className="text-red-600 hover:text-red-900 px-2 py-1 text-xs hover:bg-red-50 rounded"
                        title="Delete"
                        aria-label="Delete"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={trainings.length * totalPages}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </>
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
