import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { PersonCell } from '@/components/ui/Avatar';
import Alert from '@/components/ui/Alert';
import Input from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';
import { FiUsers } from 'react-icons/fi';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { madrasaService } from '@/services/madrasaService';
import { attendanceService, AttendanceRecord } from '@/services/attendanceService';
import { StudentEnrollment } from '@/services/madrasaService';
import { pct } from '@/utils/statSeries';

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
      setError("Couldn't load class. Refresh the page or try again.");
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
      setError("Couldn't load students. Refresh the page or try again.");
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
      toast.error(getFriendlyError(err, "Couldn't save attendance. Check the details and try again."));
    } finally {
      setSaving(false);
    }
  };

  const presentCount = Object.values(attendance).filter((p) => p).length;
  const totalCount = students.length;

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Attendance sheet"
        description={cls?.name}
        actions={
          <Button variant="secondary" onClick={() => navigate(`/education/classes/${classId}`)}>
            Back
          </Button>
        }
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card padding="none" className="px-3.5 py-3">
          <Input label="Date" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} />
        </Card>
        <StatCard
          variant="inline"
          title="Present"
          viz={totalCount > 0 ? { type: 'ring', percent: pct(presentCount, totalCount) } : undefined}
          summary={`${presentCount} of ${totalCount} present, ${pct(presentCount, totalCount)} percent`}
          value={`${presentCount} of ${totalCount}`}
          icon={<FiUsers className="h-[17px] w-[17px]" />}
          tone="green"
          className="h-full"
        />
      </div>

      <Card padding="none">
        {loadingAttendance ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner />
          </div>
        ) : students.length === 0 ? (
          <EmptyState title="No active students enrolled in this class" description="Enroll students from the class page." />
        ) : (
          <div>
            <div className="divide-y divide-line-soft dark:divide-surface-border">
              {students.map((student) => {
                const isPresent = attendance[student.id] || false;
                const memberName =
                  student.memberId && typeof student.memberId === 'object'
                    ? student.memberId.name
                    : '-';

                return (
                  <div
                    key={student.id}
                    className="flex min-h-11 items-center gap-3 px-3.5 py-2 transition-colors hover:bg-[#F6FAF8] dark:hover:bg-surface-hover/60"
                  >
                    <button
                      onClick={() => toggleStudent(student.id)}
                      aria-label={`Mark ${memberName} ${isPresent ? 'absent' : 'present'}`}
                      aria-pressed={isPresent}
                      className={`flex h-5 w-5 items-center justify-center rounded border-2 transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] ${
                        isPresent
                          ? 'border-primary-700 bg-primary-700 dark:border-brand-lime dark:bg-brand-lime'
                          : 'border-line-strong dark:border-surface-border-strong'
                      }`}
                    >
                      {isPresent && <span className="text-xs font-bold text-white dark:text-primary-950">✓</span>}
                    </button>
                    <div className="flex-1">
                      <PersonCell
                        name={memberName}
                        size={32}
                        subtitle={student.rollNo ? `Roll: ${student.rollNo}` : undefined}
                      />
                    </div>
                    <StatusBadge status={isPresent ? 'present' : 'absent'} />
                  </div>
                );
              })}
            </div>

            <div className="border-t border-line-soft px-3.5 py-3 dark:border-surface-border">
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
