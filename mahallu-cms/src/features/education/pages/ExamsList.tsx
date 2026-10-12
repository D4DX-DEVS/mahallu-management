import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Select from '@/components/ui/Select';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import StatusBadge from '@/components/ui/StatusBadge';
import RowActions from '@/components/ui/RowActions';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { Pagination as PaginationType, TableColumn } from '@/types';
import { formatDate } from '@/utils/format';
import { examService, Exam } from '@/services/attendanceService';
import { madrasaService } from '@/services/madrasaService';
import { PersonCell } from '@/components/ui/Avatar';

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
      console.error("Couldn't load class. Refresh the page or try again.", err);
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
      console.error("Couldn't load exams. Refresh the page or try again.", err);
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
      toast.error(getFriendlyError(err, "Couldn't delete exam. Try again in a moment."));
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn<Exam>[] = [
    { key: 'name', label: 'Exam', render: (v) => <PersonCell name={v} /> },
    { key: 'examDate', label: 'Date', render: (v) => formatDate(v) },
    { key: 'maxMarks', label: 'Max Marks', render: (v) => v },
    {
      key: 'status',
      label: 'Status',
      render: (v: string) => <StatusBadge status={v} />,
    },
    {
      key: 'actions',
      label: '',
      render: (_v, row) => (
        <RowActions
          onView={() => navigate(`/education/exams/${row.id}`)}
          viewLabel="View"
          onDelete={() => setDeleteConfirm({ id: row.id, name: row.name })}
          deleteLabel="Delete"
          disabledReason={deleting ? { delete: 'Deleting…' } : undefined}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Exams"
        description={cls?.name}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate(`/education/classes/${classId}`)}>
              Back
            </Button>
            <Button onClick={() => navigate(`/education/exams/create?classId=${classId}`)}>+ New exam</Button>
          </>
        }
      />

      <Card padding="none" className="overflow-visible">
        <FilterBar>
          <div className="w-44">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={STATUS_OPTIONS}
            />
          </div>
        </FilterBar>
        <div className="p-3.5">
          {loading ? (
            <LoadingSpinner />
          ) : exams.length === 0 ? (
            <EmptyState title="No exams yet" description="Create an exam to start recording results." />
          ) : (
            <>
              <Table columns={columns} data={exams} showExport={false} />
              {pagination && pagination.totalPages > 1 && (
                <div className="mt-3.5">
                  <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    totalItems={pagination.total}
                    itemsPerPage={pagination.limit}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Delete exam?"
        message={deleteConfirm ? `Delete the exam "${deleteConfirm.name}"?` : ''}
        consequence="This cannot be undone."
        isLoading={deleting}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
