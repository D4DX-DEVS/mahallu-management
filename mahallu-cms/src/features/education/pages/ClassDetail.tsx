import { useState, useEffect, ReactNode } from 'react';
import ActionsMenu from '@/components/ui/ActionsMenu';
import { FiCalendar, FiCheckCircle, FiEdit2, FiList, FiPlus, FiSlash, FiTrash2 } from 'react-icons/fi';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import { PageSkeleton } from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { Pagination as PaginationType, TableColumn } from '@/types';
import { formatDate } from '@/utils/format';
import {
  madrasaService,
  MadrasaClass,
  StudentEnrollment,
  EnrollmentStatus,
  ENROLLMENT_STATUS_OPTIONS,
  classTypeLabel,
  teacherName,
  studentName,
} from '@/services/madrasaService';
import { attendanceService, ClassProgress } from '@/services/attendanceService';
import EnrollStudentModal from '../components/EnrollStudentModal';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import SortableTh from '@/components/ui/SortableTh';
import { useSortableRows } from '@/hooks/useSortableRows';
import { ROUTES } from '@/constants/routes';

const STATUS_FILTER = [{ value: '', label: 'All students' }, ...ENROLLMENT_STATUS_OPTIONS];

const Field = ({ label, value }: { label: string; value: ReactNode }) => (
  <div>
    <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{value ?? '-'}</p>
  </div>
);

export default function ClassDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cls, setCls] = useState<MadrasaClass | null>(null);
  const [students, setStudents] = useState<StudentEnrollment[]>([]);
  const [progress, setProgress] = useState<ClassProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [progressLoading, setProgressLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<{ id: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (id) fetchClass(id);
  }, [id]);

  useEffect(() => {
    if (id) fetchStudents(id);
  }, [id, statusFilter, currentPage]);

  useEffect(() => {
    if (id) fetchProgress(id);
  }, [id]);

  const fetchClass = async (classId: string) => {
    try {
      setLoading(true);
      setError(null);
      setCls(await madrasaService.getClass(classId));
    } catch (err: any) {
      setError(loadErrorMessage(err, 'the class'));
    } finally {
      setLoading(false);
    }
  };

  const fetchProgress = async (classId: string) => {
    try {
      setProgressLoading(true);
      const data = await attendanceService.getClassProgress(classId);
      setProgress(data);
    } catch (err: any) {
      console.error("Couldn't load progress", err);
    } finally {
      setProgressLoading(false);
    }
  };

  const fetchStudents = async (classId: string) => {
    try {
      setStudentsLoading(true);
      const params: Record<string, any> = { page: currentPage, limit: 10 };
      if (statusFilter) params.status = statusFilter;
      const result = await madrasaService.getClassStudents(classId, params);
      setStudents(result.data);
      setPagination(result.pagination);
    } catch {
      setStudents([]);
    } finally {
      setStudentsLoading(false);
    }
  };

  const refresh = () => {
    if (!id) return;
    fetchClass(id);
    fetchStudents(id);
    fetchProgress(id);
  };

  const changeStatus = async (row: StudentEnrollment, status: EnrollmentStatus) => {
    try {
      setBusyId(row.id);
      await madrasaService.updateEnrollment(row.id, { status });
      toast.success('Enrollment updated');
      refresh();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'update enrollment' }));
    } finally {
      setBusyId(null);
    }
  };

  const handleRemoveStudent = async () => {
    if (!removeConfirm) return;
    try {
      setRemoving(true);
      await madrasaService.deleteEnrollment(removeConfirm.id);
      setRemoveConfirm(null);
      toast.success(`${toTitleCase(removeConfirm.name)} removed from class`);
      refresh();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'remove student' }));
    } finally {
      setRemoving(false);
    }
  };

  const columns: TableColumn<StudentEnrollment>[] = [
    { key: 'rollNo', label: 'Roll', width: '6rem', render: (v) => v || '-' },
    {
      key: 'memberId',
      label: 'Student',
      width: '7.75rem',
      render: (_v, row) => <span>{toTitleCase(studentName(row))}</span>,
    },
    { key: 'enrollDate', label: 'Enrolled', width: '7.75rem', render: (v) => formatDate(v) },
    { key: 'status', label: 'Status', width: '7.25rem' },
    {
      key: 'actions',
      label: 'Actions',
      width: '8rem',
      align: 'center',
      render: (_v, row) => (
        <ActionsMenu
          label={'Actions for ' + toTitleCase(studentName(row))}
          items={[
            ...(row.status === 'active'
              ? [
                  {
                    label: 'Mark completed',
                    icon: <FiCheckCircle className="h-4 w-4" />,
                    onClick: () => changeStatus(row, 'completed'),
                    disabled: busyId === row.id,
                  },
                  {
                    label: 'Mark dropped',
                    icon: <FiSlash className="h-4 w-4" />,
                    onClick: () => changeStatus(row, 'dropped'),
                    disabled: busyId === row.id,
                    variant: 'warning' as const,
                  },
                ]
              : []),
            {
              label: 'Remove from class',
              icon: <FiTrash2 className="h-4 w-4" />,
              onClick: () => setRemoveConfirm({ id: row.id, name: studentName(row) }),
              disabled: removing || busyId === row.id,
              variant: 'danger' as const,
            },
          ]}
        />
      ),
    },
  ];

  const {
    rows: sortedStudents,
    sort,
    toggleSort,
  } = useSortableRows(progress?.students ?? []);

  if (loading) return <PageSkeleton />;

  if (error || !cls) {
    return (
      <div>
        <PageHeader title="Education" breadcrumbs={[{ label: 'Services' }]} />
        <Card>
          <p className="text-sm text-red-600 dark:text-red-400">{error || 'Class not found'}</p>
          <Button className="mt-3" variant="secondary" onClick={() => navigate('/education')}>
            Back to classes
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={toTitleCase(cls.name)}
        breadcrumbs={[{ label: 'Services' }, { label: 'Education', path: '/education' }]}
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex gap-2 items-center">
          <Button variant="secondary" onClick={() => navigate(`/education/classes/${cls.id}/attendance`)} icon={<FiCalendar />} collapseLabel>Attendance</Button>
          <Button variant="secondary" onClick={() => navigate(`/education/classes/${cls.id}/exams`)} icon={<FiList />} collapseLabel>Exams</Button>
          <Button variant="secondary" onClick={() => navigate(`/education/classes/${cls.id}/edit`)} icon={<FiEdit2 />} collapseLabel>Edit class</Button>
          <Button onClick={() => setEnrollOpen(true)} icon={<FiPlus />} collapseLabel>Enroll student</Button>
        </div>
      </div>

      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">Class</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Name (Malayalam)" value={cls.nameMl || '-'} />
          <Field label="Academic Year" value={cls.academicYear || '-'} />
          <Field label="Class Type" value={classTypeLabel(cls.classType)} />
          <Field label="Teacher" value={<span>{toTitleCase(teacherName(cls))}</span>} />
          <Field
            label="Institute"
            value={
              <span>
                {cls.instituteId && typeof cls.instituteId === 'object' ? toTitleCase(cls.instituteId.name) : '-'}
              </span>
            }
          />
          <Field label="Schedule" value={cls.schedule || '-'} />
          <Field label="Active students" value={cls.studentCount ?? 0} />
          <Field label="Status" value={cls.status} />
          <div className="col-span-2 sm:col-span-3 lg:col-span-4">
            <Field label="Subjects" value={cls.subjects?.length ? cls.subjects.join(', ') : 'None listed'} />
          </div>
        </div>
      </Card>

      {progressLoading ? (
        <Card className="mb-4">
          <PageSkeleton variant="section" />
        </Card>
      ) : progress ? (
        <Card className="mb-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Progress</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <SortableTh sortKey="studentName" sort={sort} onSort={toggleSort} className="px-4 py-2">
                    Student
                  </SortableTh>
                  <SortableTh sortKey="attendance" sort={sort} onSort={toggleSort} className="px-4 py-2">
                    Attendance
                  </SortableTh>
                  <SortableTh sortKey="examAverage" sort={sort} onSort={toggleSort} className="px-4 py-2">
                    Exam Average
                  </SortableTh>
                </tr>
              </thead>
              <tbody>
                {sortedStudents.map((student, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                  >
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{toTitleCase(student.studentName)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 max-w-xs h-2 bg-gray-200 rounded dark:bg-gray-700">
                          <div
                            className="h-full bg-blue-600 rounded dark:bg-blue-500"
                            style={{ width: `${student.attendance}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400 min-w-12">
                          {student.attendance}%
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {student.attendanceCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                      {student.examAverage !== null ? (
                        <div>
                          <div className="font-medium">{student.examAverage}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {student.examCount} exam{student.examCount !== 1 ? 's' : ''}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">No exams yet</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      <TableCard>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Students</h2>
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            options={STATUS_FILTER}
          />
        </div>

        <Table
          fixedLayout
          striped
          columns={columns}
          data={students}
          isLoading={studentsLoading}
          emptyMessage="No students enrolled yet"
          onRowClick={(row) => {
            const memberId = typeof row.memberId === 'object' ? row.memberId?.id : row.memberId;
            if (memberId) navigate(ROUTES.MEMBERS.DETAIL(memberId));
          }}
        />

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

      <EnrollStudentModal
        isOpen={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        classId={cls.id}
        onEnrolled={refresh}
      />

      <ConfirmDialog
        isOpen={removeConfirm !== null}
        title="Remove Student"
        message={removeConfirm ? `Remove ${toTitleCase(removeConfirm.name)} from this class?` : ''}
        consequence="The student can be re-enrolled later."
        isLoading={removing}
        variant="danger"
        confirmLabel="Remove"
        onConfirm={handleRemoveStudent}
        onCancel={() => setRemoveConfirm(null)}
      />
    </div>
  );
}
