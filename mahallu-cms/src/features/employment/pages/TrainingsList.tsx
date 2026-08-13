import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { employmentService, type SkillTraining, type EmploymentSummary } from '@/services/employmentService';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';

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
      setTrainings((prev) => prev.filter((t) => t._id !== deleteId));
      toast.success('Training deleted successfully');
      setShowDeleteConfirm(false);
      setDeleteId(null);
    } catch (error) {
      toast.error('Failed to delete training');
      console.error('Failed to delete training:', error);
    } finally {
      setDeleting(false);
    }
  }, [deleteId]);

  const statusColor = (status: string) => {
    switch (status) {
      case 'planned':
        return 'bg-yellow-100 text-yellow-800';
      case 'ongoing':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex-1 space-y-2">
          <input
            type="text"
            placeholder="Search by training name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <Button
          onClick={() => navigate('/employment/trainings/create')}
          className="w-full sm:w-auto"
        >
          + New Training
        </Button>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <div className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.trainingsCount}</div>
              <div className="text-xs sm:text-sm text-gray-600">Total Trainings</div>
            </div>
          </Card>
          <Card>
            <div className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{summary.skilledWorkers}</div>
              <div className="text-xs sm:text-sm text-gray-600">Skilled Workers</div>
            </div>
          </Card>
          <Card>
            <div className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{summary.registeredJobSeekers}</div>
              <div className="text-xs sm:text-sm text-gray-600">Job Seekers</div>
            </div>
          </Card>
          <Card>
            <div className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{summary.employersCount}</div>
              <div className="text-xs sm:text-sm text-gray-600">Employers</div>
            </div>
          </Card>
        </div>
      )}

      {loading ? (
        <Card>
          <div className="p-8 text-center">Loading trainings...</div>
        </Card>
      ) : trainings.length === 0 ? (
        <Card>
          <div className="p-8 text-center text-gray-500">
            <p>No skill trainings found</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Training Name</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 hidden sm:table-cell">
                    Duration
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-700">Participants</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {trainings.map((training) => (
                  <tr key={training._id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900">{training.name}</div>
                      <div className="text-xs text-gray-500">{training.trainerName || 'No trainer'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm hidden sm:table-cell text-gray-700">
                      {new Date(training.startDate).toLocaleDateString()} -{' '}
                      {new Date(training.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColor(training.status)}`}>
                        {training.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="text-sm text-gray-700">
                        {training.participantCount || training.participants?.length || 0}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => navigate(`/employment/trainings/${training._id}`)}
                        className="text-blue-600 hover:text-blue-900 px-2 py-1 text-xs hover:bg-blue-50 rounded"
                        title="View"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(training._id)}
                        className="text-red-600 hover:text-red-900 px-2 py-1 text-xs hover:bg-red-50 rounded"
                        title="Delete"
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
