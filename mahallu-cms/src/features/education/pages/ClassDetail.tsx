import { useState, useEffect, ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
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
      setError(err.response?.data?.message || 'Failed to load the class');
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
      console.error('Failed to load progress', err);
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
      setBusyId(row._id);
      await madrasaService.updateEnrollment(row._id, { status });
      refresh();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update the enrollment');
    } finally {
      setBusyId(null);
    }
  };

  const removeStudent = async (row: StudentEnrollment) => {
    if (!confirm(`Remove ${studentName(row)} from this class?`)) return;
    try {
      setBusyId(row._id);
      await madrasaService.deleteEnrollment(row._id);
      refresh();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to remove the student');
    } finally {
      setBusyId(null);
    }
  };

  const columns: TableColumn<StudentEnrollment>[] = [
    { key: 'rollNo', label: 'Roll', render: (v) => v || '-' },
    { key: 'memberId', label: 'Student', render: (_v, row) => studentName(row) },
    { key: 'enrollDate', label: 'Enrolled', render: (v) => formatDate(v) },
    { key: 'status', label: 'Status' },
    {
      key: 'actions',
      label: '',
      render: (_v, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {row.status === 'active' && (
            <button
              onClick={() => changeStatus(row, 'completed')}
              disabled={busyId === row._id}
              className="text-xs font-medium text-green-600 hover:underline disabled:opacity-50 dark:text-green-400"
            >
              Complete
            </button>
          )}
          {row.status === 'active' && (
            <button
              onClick={() => changeStatus(row, 'dropped')}
              disabled={busyId === row._id}
              className="text-xs font-medium text-amber-600 hover:underline disabled:opacity-50 dark:text-amber-400"
            >
              Drop
            </button>
          )}
          <button
            onClick={() => removeStudent(row)}
            disabled={busyId === row._id}
            className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
          >
            Remove
          </button>
        </div>
      ),
    },
  ];

  if (loading) return <LoadingSpinner />;

  if (error || !cls) {
    return (
      <div>
        <Breadcrumb items={[{ label: 'Services' }, { label: 'Education', path: '/education' }]} />
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
      <Breadcrumb
        items={[
          { label: 'Services' },
          { label: 'Education', path: '/education' },
          { label: cls.name },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{cls.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {classTypeLabel(cls.classType)} · {cls.academicYear}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => navigate(`/education/classes/${cls._id}/attendance`)}>
            Attendance
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/education/classes/${cls._id}/exams`)}>
            Exams
          </Button>
          <Button variant="secondary" onClick={() => navigate(`/education/classes/${cls._id}/edit`)}>
            Edit class
          </Button>
          <Button onClick={() => setEnrollOpen(true)}>Enroll student</Button>
        </div>
      </div>

      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Class</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Name (Malayalam)" value={cls.nameMl || '-'} />
          <Field label="Teacher" value={teacherName(cls)} />
          <Field
            label="Institute"
            value={
              cls.instituteId && typeof cls.instituteId === 'object' ? cls.instituteId.name : '-'
            }
          />
          <Field label="Schedule" value={cls.schedule || '-'} />
          <Field label="Active students" value={cls.studentCount ?? 0} />
          <Field label="Status" value={cls.status} />
          <div className="col-span-2 sm:col-span-3 lg:col-span-4">
            <Field
              label="Subjects"
              value={cls.subjects?.length ? cls.subjects.join(', ') : 'None listed'}
            />
          </div>
        </div>
      </Card>

      {progressLoading ? (
        <Card className="mb-4">
          <LoadingSpinner />
        </Card>
      ) : progress ? (
        <Card className="mb-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">Progress</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                    Student
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                    Attendance
                  </th>
                  <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                    Exam Average
                  </th>
                </tr>
              </thead>
              <tbody>
                {progress.students.map((student, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                  >
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{student.studentName}</td>
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

      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Students</h2>
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
          columns={columns}
          data={students}
          isLoading={studentsLoading}
          emptyMessage="No students enrolled yet"
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
      </Card>

      <EnrollStudentModal
        isOpen={enrollOpen}
        onClose={() => setEnrollOpen(false)}
        classId={cls._id}
        onEnrolled={refresh}
      />
    </div>
  );
}
