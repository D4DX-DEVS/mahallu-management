import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Select from '@/components/ui/Select';
import { toast } from '@/store/toastStore';
import { Pagination as PaginationType, TableColumn } from '@/types';
import { formatDate } from '@/utils/format';
import { examService, Exam, ExamStatus } from '@/services/attendanceService';
import { madrasaService } from '@/services/madrasaService';

const STATUS_OPTIONS = [
  { value: '', label: 'All status' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function ExamsList() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();

  const [exams, setExams] = useState<Exam[]>([]);
  const [cls, setCls] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (classId) {
      fetchClass(classId);
      fetchExams(classId);
    }
  }, [classId, currentPage, statusFilter]);

  const fetchClass = async (classId: string) => {
    try {
      setCls(await madrasaService.getClass(classId));
    } catch (err: any) {
      console.error('Failed to load class', err);
    }
  };

  const fetchExams = async (classId: string) => {
    try {
      setLoading(true);
      const params: Record<string, any> = {
        classId,
        page: currentPage,
        limit: 10,
      };
      if (statusFilter) params.status = statusFilter;

      const result = await examService.listExams(params);
      setExams(result.data);
      setPagination(result.pagination);
    } catch (err: any) {
      console.error('Failed to load exams', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    try {
      setDeleting(true);
      await examService.deleteExam(deleteConfirm.id);
      setDeleteConfirm(null);
      toast.success(`Exam "${deleteConfirm.name}" deleted`);
      if (classId) {
        fetchExams(classId);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete exam');
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn<Exam>[] = [
    { key: 'name', label: 'Exam', render: (v) => v },
    { key: 'examDate', label: 'Date', render: (v) => formatDate(v) },
    { key: 'maxMarks', label: 'Max Marks', render: (v) => v },
    {
      key: 'status',
      label: 'Status',
      render: (v: ExamStatus) => {
        const colors: Record<ExamStatus, string> = {
          scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
          completed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
          cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
        };
        return (
          <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${colors[v] || ''}`}>
            {v}
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: '',
      render: (_v, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => navigate(`/education/exams/${row._id}`)}
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            View
          </button>
          <button
            onClick={() => setDeleteConfirm({ id: row._id, name: row.name })}
            disabled={deleting}
            className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
          >
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Services' },
          { label: 'Education', path: '/education' },
          { label: cls?.name || 'Class', path: `/education/classes/${classId}` },
          { label: 'Exams' },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Exams</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{cls?.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate(`/education/classes/${classId}`)}>
            Back
          </Button>
          <Button onClick={() => navigate(`/education/exams/create?classId=${classId}`)}>
            New exam
          </Button>
        </div>
      </div>

      <Card className="mb-4">
        <Select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setCurrentPage(1);
          }}
          options={STATUS_OPTIONS}
        />
      </Card>

      {loading ? (
        <LoadingSpinner />
      ) : exams.length === 0 ? (
        <Card>
          <EmptyState title="No exams yet" description="Create an exam to start recording results." />
        </Card>
      ) : (
        <Card>
          <Table columns={columns} data={exams} />
          {pagination && pagination.totalPages > 1 && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={setCurrentPage}
            />
          )}
        </Card>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Delete Exam"
        message={deleteConfirm ? `Delete the exam "${deleteConfirm.name}"?` : ''}
        consequence="This action cannot be undone."
        isLoading={deleting}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
