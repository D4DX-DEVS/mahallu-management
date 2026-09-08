import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { toast } from '@/store/toastStore';
import { examService, Exam } from '@/services/attendanceService';
import {
  madrasaService,
  StudentEnrollment,
  studentName as rosterStudentName,
} from '@/services/madrasaService';
import { formatDate } from '@/utils/format';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

export default function ExamDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [exam, setExam] = useState<Exam | null>(null);
  const [roster, setRoster] = useState<StudentEnrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingResults, setEditingResults] = useState<Record<string, { marks: number; grade?: string }>>({});
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

      // The roster (currently enrolled students) drives result entry — a brand-new
      // exam has no results yet, so relying on data.results would leave nothing to mark.
      const classId = typeof data.classId === 'string' ? data.classId : data.classId?.id;
      const classStudents = classId
        ? (await madrasaService.getClassStudents(classId, { limit: 200, status: 'active' })).data
        : [];
      setRoster(classStudents);

      const existingByEnrollment: Record<string, { marks: number; grade?: string }> = {};
      data.results.forEach((r) => {
        const enrollmentId = typeof r.enrollmentId === 'string' ? r.enrollmentId : r.enrollmentId.id;
        existingByEnrollment[enrollmentId] = { marks: r.marks, grade: r.grade };
      });

      const initial: Record<string, { marks: number; grade?: string }> = {};
      classStudents.forEach((s) => {
        initial[s.id] = existingByEnrollment[s.id] || { marks: 0, grade: undefined };
      });
      setEditingResults(initial);
    } catch (err: any) {
      setError("Couldn't load exam");
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
      toast.error(errorMessage(err, { action: 'save results' }));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton />;

  if (error || !exam) {
    return (
      <div>
        <PageHeader title="Education" breadcrumbs={[{ label: 'Services' }]} />
        <Card>
          <p className="text-sm text-red-600 dark:text-red-400">{error || 'Exam not found'}</p>
          <Button className="mt-3" variant="secondary" onClick={() => navigate('/education')}>
            Back
          </Button>
        </Card>
      </div>
    );
  }

  const classId = typeof exam.classId === 'string' ? exam.classId : exam.classId?.id;
  const className = typeof exam.classId === 'string' ? '-' : exam.classId?.name || '-';

  return (
    <div>
      <PageHeader
        title={exam.name}
        breadcrumbs={[
          { label: 'Services' },
          { label: 'Education', path: '/education' },
          { label: className, path: `/education/classes/${classId}` },
          { label: 'Exams', path: `/education/classes/${classId}/exams` },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Button variant="secondary" onClick={() => navigate(`/education/classes/${classId}/exams`)}>
          Back
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-4">
        <Card>
          <p className="text-xs text-gray-500 dark:text-gray-400">Date</p>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatDate(exam.examDate)}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 dark:text-gray-400">Max Marks</p>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{exam.maxMarks}</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
          <span className="inline-block rounded px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
            {exam.status || 'scheduled'}
          </span>
        </Card>
        <Card>
          <p className="text-xs text-gray-500 dark:text-gray-400">Results</p>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {exam.results?.length || 0} / {roster.length}
          </p>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Results</h2>
          {!isEditingResults && (
            <Button variant="secondary" size="sm" onClick={() => setIsEditingResults(true)}>
              Edit results
            </Button>
          )}
        </div>

        {(() => {
          // Editing draws rows from the class roster (so a fresh exam with zero
          // results still has someone to mark); viewing shows only saved results.
          const rows = isEditingResults
            ? roster.map((s) => ({
                enrollmentId: s.id,
                studentName: rosterStudentName(s),
                rollNo: s.rollNo || '-',
                marks: editingResults[s.id]?.marks ?? 0,
                grade: editingResults[s.id]?.grade,
              }))
            : exam.results.map((result) => {
                const enrollmentObj = typeof result.enrollmentId === 'string' ? null : result.enrollmentId;
                const enrollmentId =
                  typeof result.enrollmentId === 'string' ? result.enrollmentId : result.enrollmentId.id;
                return {
                  enrollmentId,
                  studentName: result.studentName || '-',
                  rollNo: enrollmentObj?.rollNo || (result as any).rollNo || '-',
                  marks: result.marks,
                  grade: result.grade,
                };
              });

          if (rows.length === 0) {
            return (
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                {isEditingResults ? 'No students enrolled in this class yet' : 'No results recorded yet'}
              </p>
            );
          }

          return (
            <div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                        Student
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                        Roll
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                        Marks
                      </th>
                      <th className="px-4 py-2 text-left font-medium text-gray-700 dark:text-gray-300">
                        Grade
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const { marks, grade } = row;

                      return (
                        <tr
                          key={row.enrollmentId}
                          className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                        >
                          <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{row.studentName}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{row.rollNo}</td>
                          <td className="px-4 py-3">
                            {isEditingResults ? (
                              <input
                                aria-label="Value"
                                type="number"
                                min="0"
                                max={exam.maxMarks}
                                value={marks}
                                onChange={(e) => handleMarksChange(row.enrollmentId, e.target.value)}
                                className="w-16 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                              />
                            ) : (
                              <span className="font-medium text-gray-900 dark:text-gray-100">{marks}</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isEditingResults ? (
                              <input
                                aria-label="A, B, C"
                                type="text"
                                value={grade || ''}
                                onChange={(e) => handleGradeChange(row.enrollmentId, e.target.value)}
                                placeholder="A, B, C..."
                                className="w-20 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                              />
                            ) : (
                              <span className="text-gray-600 dark:text-gray-400">{grade || '-'}</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {isEditingResults && (
                <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
                  <Button onClick={saveResults} disabled={saving}>
                    {saving ? 'Saving...' : 'Save results'}
                  </Button>
                  <Button variant="secondary" onClick={() => setIsEditingResults(false)} disabled={saving}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          );
        })()}
      </Card>
    </div>
  );
}
