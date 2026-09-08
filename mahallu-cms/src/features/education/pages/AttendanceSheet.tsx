import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { toast } from '@/store/toastStore';
import { madrasaService } from '@/services/madrasaService';
import { attendanceService, AttendanceRecord } from '@/services/attendanceService';
import { StudentEnrollment } from '@/services/madrasaService';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import DatePicker from '@/components/ui/DatePicker';

export default function AttendanceSheet() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();

  const [cls, setCls] = useState<any>(null);
  const [students, setStudents] = useState<StudentEnrollment[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [attendance, setAttendance] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (classId) {
      fetchClass(classId);
      fetchStudents(classId);
    }
  }, [classId]);

  useEffect(() => {
    if (classId && selectedDate) {
      loadAttendanceForDate(classId, selectedDate);
    }
  }, [classId, selectedDate]);

  const fetchClass = async (classId: string) => {
    try {
      setCls(await madrasaService.getClass(classId));
    } catch (err: any) {
      setError("Couldn't load class");
    }
  };

  const fetchStudents = async (classId: string) => {
    try {
      setLoading(true);
      const result = await madrasaService.getClassStudents(classId, { limit: 100 });
      const activeStudents = result.data.filter((s) => s.status === 'active');
      setStudents(activeStudents);

      // Initialize attendance state
      const initial: Record<string, boolean> = {};
      activeStudents.forEach((s) => {
        initial[s.id] = false;
      });
      setAttendance(initial);
    } catch (err: any) {
      setError("Couldn't load students");
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceForDate = async (classId: string, date: string) => {
    try {
      setLoadingAttendance(true);
      const result = await attendanceService.listAttendance({
        classId,
        month: date.substring(0, 7), // YYYY-MM
      });

      // Find attendance record for this specific date
      const recordForDate = result.data.find((rec) => rec.date.split('T')[0] === date);

      if (recordForDate) {
        const attendanceMap: Record<string, boolean> = {};
        students.forEach((s) => {
          attendanceMap[s.id] = false;
        });
        recordForDate.records.forEach((r) => {
          const enrollmentId = typeof r.enrollmentId === 'string' ? r.enrollmentId : r.enrollmentId.id;
          attendanceMap[enrollmentId] = r.present;
        });
        setAttendance(attendanceMap);
      } else {
        // No record for this date, reset to all absent
        const initial: Record<string, boolean> = {};
        students.forEach((s) => {
          initial[s.id] = false;
        });
        setAttendance(initial);
      }
    } catch (err: any) {
      // If no records found, just show empty state
      console.error('Error loading attendance', err);
    } finally {
      setLoadingAttendance(false);
    }
  };

  const toggleStudent = (enrollmentId: string) => {
    setAttendance((prev) => ({
      ...prev,
      [enrollmentId]: !prev[enrollmentId],
    }));
  };

  const saveAttendance = async () => {
    if (!classId) return;

    try {
      setSaving(true);
      const records = students.map((s) => ({
        enrollmentId: s.id,
        present: attendance[s.id] || false,
      }));

      await attendanceService.upsertAttendance(classId, selectedDate, records);
      const dateStr = new Date(selectedDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      toast.success(`Attendance saved for ${dateStr}`);
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'save attendance' }));
    } finally {
      setSaving(false);
    }
  };

  const presentCount = Object.values(attendance).filter((p) => p).length;
  const totalCount = students.length;

  if (loading) return <PageSkeleton />;

  return (
    <div>
      <PageHeader
        description={cls?.name}
        title="Attendance"
        breadcrumbs={[
          { label: 'Services' },
          { label: 'Education', path: '/education' },
          { label: cls?.name || 'Class', path: `/education/classes/${classId}` },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={() => navigate(`/education/classes/${classId}`)}>
          Back
        </Button>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <DatePicker label="Date" value={selectedDate} onChange={(value) => setSelectedDate(value)} />
          </div>
          <div className="flex items-end">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium">{presentCount}</span> of {totalCount} present
            </div>
          </div>
        </div>
      </Card>

      <Card>
        {loadingAttendance ? (
          <PageSkeleton variant="section" />
        ) : students.length === 0 ? (
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            No active students enrolled in this class
          </p>
        ) : (
          <div>
            <div className="space-y-2 mb-4">
              {students.map((student) => {
                const isPresent = attendance[student.id] || false;
                const memberName =
                  student.memberId && typeof student.memberId === 'object' ? student.memberId.name : '-';

                return (
                  <div
                    key={student.id}
                    className="flex items-center gap-3 rounded border border-gray-200 px-4 py-3 dark:border-gray-700"
                  >
                    <button
                      onClick={() => toggleStudent(student.id)}
                      className={`flex h-5 w-5 items-center justify-center rounded border-2 transition ${
                        isPresent
                          ? 'border-green-600 bg-green-600 dark:border-green-500 dark:bg-green-500'
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                    >
                      {isPresent && <span className="text-white text-xs font-bold">✓</span>}
                    </button>
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{memberName}</div>
                      {student.rollNo && (
                        <div className="text-xs text-gray-500 dark:text-gray-400">Roll: {student.rollNo}</div>
                      )}
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        isPresent ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'
                      }`}
                    >
                      {isPresent ? 'Present' : 'Absent'}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
              <Button onClick={saveAttendance} disabled={saving} className="w-full sm:w-auto">
                {saving ? 'Saving...' : 'Save Attendance'}
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
