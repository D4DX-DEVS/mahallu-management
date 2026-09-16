import { useState, useEffect } from 'react';
import ActionsMenu from '@/components/ui/ActionsMenu';
import { FiArrowLeft, FiEye, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import { PageSkeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Select from '@/components/ui/Select';
import { toast } from '@/store/toastStore';
import { Pagination as PaginationType, TableColumn } from '@/types';
import { formatDate, toTitleCase } from '@/utils/format';
import { examService, Exam, ExamStatus } from '@/services/attendanceService';
import { madrasaService } from '@/services/madrasaService';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';

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
      console.error("Couldn't load class", err);
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
      console.error("Couldn't load exams", err);
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
      toast.success(`Exam "${toTitleCase(deleteConfirm.name)}" deleted`);
      if (classId) {
        fetchExams(classId);
      }
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete exam' }));
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn<Exam>[] = [
    { key: 'name', label: 'Exam', width: '6.75rem', render: (v) => <span>{toTitleCase(v)}</span> },
    { key: 'examDate', label: 'Date', width: '6.25rem', render: (v) => formatDate(v) },
    { key: 'maxMarks', label: 'Max Marks', width: '9.5rem', render: (v) => v },
    {
      key: 'status',
      label: 'Status',
      width: '7.25rem',
      render: (v: ExamStatus) => <StatusBadge status={v} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '8rem',
      align: 'center',
      render: (_v, row) => (
        <ActionsMenu
          label={'Actions for ' + toTitleCase(row.name)}
          items={[
            {
              label: 'View',
              icon: <FiEye className="h-4 w-4" />,
              onClick: () => navigate(`/education/exams/${row.id}`),
            },
            {
              label: 'Delete',
              icon: <FiTrash2 className="h-4 w-4" />,
              onClick: () => setDeleteConfirm({ id: row.id, name: row.name }),
              disabled: deleting,
              variant: 'danger' as const,
            },
          ]}
        />
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        description={cls?.name ? toTitleCase(cls.name) : undefined}
        title="Exams"
        breadcrumbs={[
          { label: 'Services' },
          { label: 'Education', path: '/education' },
          { label: cls?.name ? toTitleCase(cls.name) : 'Class', path: `/education/classes/${classId}` },
        ]}
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex gap-2 items-center">
          <Button variant="secondary" onClick={() => navigate(`/education/classes/${classId}`)} icon={<FiArrowLeft />} collapseLabel>Back</Button>
          <Button onClick={() => navigate(`/education/exams/create?classId=${classId}`)} icon={<FiPlus />} collapseLabel>New exam</Button>
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
        <PageSkeleton variant="section" />
      ) : exams.length === 0 ? (
        <Card>
          <EmptyState title="No exams yet" description="Create an exam to start recording results." />
        </Card>
      ) : (
        <TableCard>
          <Table fixedLayout striped columns={columns} data={exams} />
          {pagination && pagination.totalPages > 1 && (
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={setCurrentPage}
            />
          )}
        </TableCard>
      )}

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Delete Exam"
        message={deleteConfirm ? `Delete the exam "${toTitleCase(deleteConfirm.name)}"?` : ''}
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
