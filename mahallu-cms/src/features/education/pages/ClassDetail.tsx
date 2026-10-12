import { useState, useEffect, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import Tabs from '@/components/ui/Tabs';
import StatusBadge from '@/components/ui/StatusBadge';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import Avatar from '@/components/ui/Avatar';
import Alert from '@/components/ui/Alert';
import { FiCheckCircle, FiUserMinus } from 'react-icons/fi';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
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
import ScrollX from '@/features/_shared/ScrollX';

const STATUS_FILTER = [{ value: '', label: 'All students' }, ...ENROLLMENT_STATUS_OPTIONS];

const Field = ({ label, value }: { label: string; value: ReactNode }) => (
  <div>
    <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#7B8983] dark:text-surface-muted">{label}</p>
    <div className="mt-0.5 text-[13px] font-semibold text-[#18231E] dark:text-surface-text">{value ?? '-'}</div>
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
  const [tab, setTab] = useState<'students' | 'progress'>('students');

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
      setError(getFriendlyError(err, "Couldn't load the class. Refresh the page or try again."));
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
      console.error("Couldn't load progress. Refresh the page or try again.", err);
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
      toast.error(getFriendlyError(err, "Couldn't update enrollment. Try again in a moment."));
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
      toast.success(`${removeConfirm.name} removed from class`);
      refresh();
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't remove student. Try again in a moment."));
    } finally {
      setRemoving(false);
    }
  };

  const columns: TableColumn<StudentEnrollment>[] = [
    { key: 'rollNo', label: 'Roll', render: (v) => v || '-' },
    { key: 'memberId', label: 'Student', render: (_v, row) => <PersonCell name={studentName(row)} size={32} /> },
    { key: 'enrollDate', label: 'Enrolled', render: (v) => formatDate(v) },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'actions',
      label: '',
      render: (_v, row) => (
        <RowActions
          extra={[
            {
              label: 'Complete',
              icon: <FiCheckCircle />,
              onClick: () => changeStatus(row, 'completed'),
              show: row.status === 'active',
              disabledReason: busyId === row.id ? 'Updating…' : undefined,
            },
            {
              label: 'Drop',
              icon: <FiUserMinus />,
              onClick: () => changeStatus(row, 'dropped'),
              show: row.status === 'active',
              disabledReason: busyId === row.id ? 'Updating…' : undefined,
            },
          ]}
          onDelete={() => setRemoveConfirm({ id: row.id, name: studentName(row) })}
          deleteLabel="Remove"
          disabledReason={removing || busyId === row.id ? { delete: 'Please wait…' } : undefined}
        />
      ),
    },
  ];

  if (loading) return <LoadingSpinner />;

  if (error || !cls) {
    return (
      <div className="space-y-4">
        <Alert
          tone="danger"
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate('/education')}>
              Back to classes
            </Button>
          }
        >
          {error || 'Class not found'}
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        leading={<Avatar size={56} name={cls.name} />}
        title={cls.name}
        description={`${classTypeLabel(cls.classType)} · ${cls.academicYear}`}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate(`/education/classes/${cls.id}/attendance`)}>
              Attendance
            </Button>
            <Button variant="secondary" onClick={() => navigate(`/education/classes/${cls.id}/exams`)}>
              Exams
            </Button>
            <Button variant="secondary" onClick={() => navigate(`/education/classes/${cls.id}/edit`)}>
              Edit class
            </Button>
            <Button onClick={() => setEnrollOpen(true)}>Enroll student</Button>
          </>
        }
      />

      <Card padding="lg">
        <h2 className="mb-3 text-[13px] font-bold text-[#18231E] dark:text-surface-text">Class</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Name (Malayalam)" value={cls.nameMl || '-'} />
          <Field label="Teacher" value={teacherName(cls) === 'Not assigned' ? teacherName(cls) : <PersonCell name={teacherName(cls)} size={24} />} />
          <Field
            label="Institute"
            value={
              cls.instituteId && typeof cls.instituteId === 'object' ? cls.instituteId.name : '-'
            }
          />
          <Field label="Schedule" value={cls.schedule || '-'} />
          <Field label="Active students" value={cls.studentCount ?? 0} />
          <Field label="Status" value={<StatusBadge status={cls.status} />} />
          <div className="col-span-2 sm:col-span-3 lg:col-span-4">
            <Field
              label="Subjects"
              value={cls.subjects?.length ? cls.subjects.join(', ') : 'None listed'}
            />
          </div>
        </div>
      </Card>

      <Tabs
        aria-label="Class sections"
        value={tab}
        onChange={(v) => setTab(v as 'students' | 'progress')}
        tabs={[
          { value: 'students', label: 'Students', count: pagination?.total },
          { value: 'progress', label: 'Progress' },
        ]}
      />

      {tab === 'progress' &&
        (progressLoading ? (
          <Card>
            <LoadingSpinner />
          </Card>
        ) : progress ? (
          <Card padding="none">
            <ScrollX>
              <table className="w-full border-collapse text-[12.5px]">
                <thead className="bg-[#FAFCFB] dark:bg-surface-base/60">
                  <tr className="border-b border-line-soft dark:border-surface-border">
                    <th className="px-3.5 py-2.5 text-left text-[12px] font-bold uppercase tracking-[0.06em] text-[#7B8983] dark:text-surface-muted">
                      Student
                    </th>
                    <th className="px-3.5 py-2.5 text-left text-[12px] font-bold uppercase tracking-[0.06em] text-[#7B8983] dark:text-surface-muted">
                      Attendance
                    </th>
                    <th className="px-3.5 py-2.5 text-left text-[12px] font-bold uppercase tracking-[0.06em] text-[#7B8983] dark:text-surface-muted">
                      Exam Average
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft dark:divide-surface-border">
                  {progress.students.map((student, idx) => (
                    <tr key={idx} className="h-11 transition-colors hover:bg-[#F6FAF8] dark:hover:bg-surface-hover/60">
                      <td className="px-3.5 py-2 font-semibold text-[#18231E] dark:text-surface-text"><PersonCell name={student.studentName} size={24} /></td>
                      <td className="px-3.5 py-2">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 max-w-xs flex-1 rounded-md bg-[#E7EEEA] dark:bg-surface-raised">
                            <div
                              className="h-full rounded-md bg-progress-brand"
                              style={{ width: `${student.attendance}%` }}
                            />
                          </div>
                          <span className="min-w-12 text-xs font-bold text-[#5B6963] dark:text-surface-muted">
                            {student.attendance}%
                          </span>
                        </div>
                        <span className="text-xs text-[#7B8983] dark:text-surface-muted">
                          {student.attendanceCount}
                        </span>
                      </td>
                      <td className="px-3.5 py-2 text-[#18231E] dark:text-surface-text">
                        {student.examAverage !== null ? (
                          <div>
                            <div className="font-semibold">{student.examAverage}</div>
                            <div className="text-xs text-[#7B8983] dark:text-surface-muted">
                              {student.examCount} exam{student.examCount !== 1 ? 's' : ''}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[#98A59F]">No exams yet</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollX>
          </Card>
        ) : null)}

      {tab === 'students' && (
        <Card padding="none" className="overflow-visible">
          <FilterBar>
            <div className="w-44">
              <Select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                options={STATUS_FILTER}
              />
            </div>
          </FilterBar>

          <div className="p-3.5">
            <Table
              columns={columns}
              data={students}
              isLoading={studentsLoading}
              emptyMessage="No students enrolled yet"
              showExport={false}
            />

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
          </div>
        </Card>
      )}

      <EnrollStudentModal
        isOpen={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        classId={cls.id}
        onEnrolled={refresh}
      />

      <ConfirmDialog
        isOpen={removeConfirm !== null}
        title="Remove student?"
        message={removeConfirm ? `Remove ${removeConfirm.name} from this class?` : ''}
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
