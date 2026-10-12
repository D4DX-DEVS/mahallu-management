import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import { PersonCell } from '@/components/ui/Avatar';
import Avatar from '@/components/ui/Avatar';
import Alert from '@/components/ui/Alert';
import Input from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { examService, Exam } from '@/services/attendanceService';
import { madrasaService } from '@/services/madrasaService';
import { formatDate } from '@/utils/format';
import ScrollX from '@/features/_shared/ScrollX';

export default function ExamDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingResults, setEditingResults] = useState<
    Record<string, { marks: number; grade?: string }>
  >({});
  const [isEditingResults, setIsEditingResults] = useState(false);

  useEffect(() => {
    if (id) fetchExam(id);
  }, [id]);

  const fetchExam = async (examId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await examService.getExam(examId);
      setExam(data);

      // Initialize editing state
      const initial: Record<string, { marks: number; grade?: string }> = {};
      data.results.forEach((r) => {
        const enrollmentId = typeof r.enrollmentId === 'string' ? r.enrollmentId : r.enrollmentId.id;
        initial[enrollmentId] = {
          marks: r.marks,
          grade: r.grade,
        };
      });
      setEditingResults(initial);
    } catch (err: any) {
      setError("Couldn't load exam. Refresh the page or try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleMarksChange = (enrollmentId: string, marks: string) => {
    setEditingResults((prev) => ({
      ...prev,
      [enrollmentId]: {
        ...prev[enrollmentId],
        marks: Math.max(0, Math.min(exam?.maxMarks || 100, parseInt(marks) || 0)),
      },
    }));
  };

  const handleGradeChange = (enrollmentId: string, grade: string) => {
    setEditingResults((prev) => ({
      ...prev,
      [enrollmentId]: {
        ...prev[enrollmentId],
        grade,
      },
    }));
  };

  const saveResults = async () => {
    if (!exam) return;

    try {
      setSaving(true);
      const results = Object.entries(editingResults).map(([enrollmentId, data]) => ({
        enrollmentId,
        marks: data.marks,
        grade: data.grade || undefined,
      }));

      await examService.updateExamResults(exam.id, results);
      toast.success('Results saved');
      setIsEditingResults(false);
      if (id) fetchExam(id);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't save results. Check the details and try again."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (error || !exam) {
    return (
      <Alert
        tone="danger"
        action={
          <Button variant="secondary" size="sm" onClick={() => navigate('/education')}>
            Back
          </Button>
        }
      >
        {error || 'Exam not found'}
      </Alert>
    );
  }

  const classId = typeof exam.classId === 'string' ? exam.classId : exam.classId?.id;
  const className = typeof exam.classId === 'string' ? '-' : exam.classId?.name || '-';

  return (
    <div className="space-y-4">
      <PageHeader
        leading={<Avatar size={56} name={exam.name} />}
        title={exam.name}
        description={`${className} · ${formatDate(exam.examDate)} · Max ${exam.maxMarks} marks`}
        actions={
          <Button variant="secondary" onClick={() => navigate(`/education/classes/${classId}/exams`)}>
            Back
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard variant="inline" title="Date" value={formatDate(exam.examDate)} tone="neutral" />
        <StatCard variant="inline" title="Max Marks" value={exam.maxMarks} tone="green" />
        <StatCard variant="inline" title="Status" value={<StatusBadge status={exam.status || 'scheduled'} />} summary={`Status: ${exam.status || 'scheduled'}`} />
        <StatCard
          variant="inline"
          title="Results"
          value={`${exam.results?.length || 0} / ${exam.results?.length || 0}`}
          tone="lime"
        />
      </div>

      <Card padding="none">
        <div className="flex items-center justify-between border-b border-line-soft px-3.5 py-3 dark:border-surface-border">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Results</h2>
          {!isEditingResults && (
            <Button variant="secondary" size="sm" onClick={() => setIsEditingResults(true)}>
              Edit results
            </Button>
          )}
        </div>

        {exam.results && exam.results.length > 0 ? (
          <div>
            <ScrollX>
              <table className="w-full border-collapse text-[12.5px]">
                <thead className="bg-[#FAFCFB] dark:bg-surface-base/60">
                  <tr className="border-b border-line-soft dark:border-surface-border">
                    <th className="px-3.5 py-2.5 text-left text-[12px] font-bold uppercase tracking-[0.06em] text-[#7B8983] dark:text-surface-muted">
                      Student
                    </th>
                    <th className="px-3.5 py-2.5 text-left text-[12px] font-bold uppercase tracking-[0.06em] text-[#7B8983] dark:text-surface-muted">
                      Roll
                    </th>
                    <th className="px-3.5 py-2.5 text-left text-[12px] font-bold uppercase tracking-[0.06em] text-[#7B8983] dark:text-surface-muted">
                      Marks
                    </th>
                    <th className="px-3.5 py-2.5 text-left text-[12px] font-bold uppercase tracking-[0.06em] text-[#7B8983] dark:text-surface-muted">
                      Grade
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft dark:divide-surface-border">
                  {exam.results.map((result, idx) => {
                    const enrollmentObj = typeof result.enrollmentId === 'string' ? null : result.enrollmentId;
                    const enrollmentId =
                      typeof result.enrollmentId === 'string'
                        ? result.enrollmentId
                        : result.enrollmentId.id;
                    const studentName = result.studentName || '-';
                    const rollNo = enrollmentObj?.rollNo || (result as any).rollNo || '-';
                    const marks = editingResults[enrollmentId]?.marks ?? result.marks;
                    const grade = editingResults[enrollmentId]?.grade ?? result.grade;

                    return (
                      <tr
                        key={idx}
                        className="h-11 transition-colors hover:bg-[#F6FAF8] dark:hover:bg-surface-hover/60"
                      >
                        <td className="px-3.5 py-2 font-semibold text-[#18231E] dark:text-surface-text"><PersonCell name={studentName} size={32} /></td>
                        <td className="px-3.5 py-2 text-[#5B6963] dark:text-surface-muted">{rollNo}</td>
                        <td className="px-3.5 py-2">
                          {isEditingResults ? (
                            <Input
                              type="number"
                              min="0"
                              max={exam.maxMarks}
                              value={marks}
                              aria-label={`Marks for ${studentName}`}
                              onChange={(e) => handleMarksChange(enrollmentId, e.target.value)}
                              className="h-8 w-20"
                            />
                          ) : (
                            <span className="font-semibold text-[#18231E] dark:text-surface-text">{marks}</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2">
                          {isEditingResults ? (
                            <Input
                              type="text"
                              value={grade || ''}
                              aria-label={`Grade for ${studentName}`}
                              onChange={(e) => handleGradeChange(enrollmentId, e.target.value)}
                              placeholder="A, B, C..."
                              className="h-8 w-24"
                            />
                          ) : (
                            <span className="text-[#5B6963] dark:text-surface-muted">{grade || '-'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </ScrollX>

            {isEditingResults && (
              <div className="flex gap-2 border-t border-line-soft px-3.5 py-3 dark:border-surface-border">
                <Button onClick={saveResults} disabled={saving}>
                  {saving ? 'Saving...' : 'Save results'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => setIsEditingResults(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        ) : (
          <EmptyState title="No results recorded yet" description="Results will appear here once marks are entered." />
        )}
      </Card>
    </div>
  );
}
