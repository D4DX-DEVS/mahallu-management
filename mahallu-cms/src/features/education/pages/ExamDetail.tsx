import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { toast } from '@/store/toastStore';
import { examService, Exam } from '@/services/attendanceService';
import { madrasaService } from '@/services/madrasaService';
import { formatDate } from '@/utils/format';

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
        const enrollmentId = typeof r.enrollmentId === 'string' ? r.enrollmentId : r.enrollmentId._id;
        initial[enrollmentId] = {
          marks: r.marks,
          grade: r.grade,
        };
      });
      setEditingResults(initial);
    } catch (err: any) {
      setError('Failed to load exam');
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

      await examService.updateExamResults(exam._id, results);
      toast.success('Results saved successfully');
      setIsEditingResults(false);
      if (id) fetchExam(id);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save results');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton />;

  if (error || !exam) {
    return (
      <div>
        <Breadcrumb items={[{ label: 'Services' }, { label: 'Education', path: '/education' }]} />
        <Card>
          <p className="text-sm text-red-600 dark:text-red-400">{error || 'Exam not found'}</p>
          <Button className="mt-3" variant="secondary" onClick={() => navigate('/education')}>
            Back
          </Button>
        </Card>
      </div>
    );
  }

  const classId = typeof exam.classId === 'string' ? exam.classId : exam.classId?._id;
  const className = typeof exam.classId === 'string' ? '-' : exam.classId?.name || '-';

  return (
    <div>
      <Breadcrumb
        items={[
          { label: 'Services' },
          { label: 'Education', path: '/education' },
          { label: className, path: `/education/classes/${classId}` },
          { label: 'Exams', path: `/education/classes/${classId}/exams` },
          { label: exam.name },
        ]}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">{exam.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {formatDate(exam.examDate)} · Max {exam.maxMarks} marks
          </p>
        </div>
        <Button variant="secondary" onClick={() => navigate(`/education/classes/${classId}/exams`)}>
          Back
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
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
            {exam.results?.length || 0} / {exam.results?.length || 0}
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

        {exam.results && exam.results.length > 0 ? (
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
                  {exam.results.map((result, idx) => {
                    const enrollmentObj = typeof result.enrollmentId === 'string' ? null : result.enrollmentId;
                    const enrollmentId =
                      typeof result.enrollmentId === 'string'
                        ? result.enrollmentId
                        : result.enrollmentId._id;
                    const studentName = result.studentName || '-';
                    const rollNo = enrollmentObj?.rollNo || (result as any).rollNo || '-';
                    const marks = editingResults[enrollmentId]?.marks ?? result.marks;
                    const grade = editingResults[enrollmentId]?.grade ?? result.grade;

                    return (
                      <tr
                        key={idx}
                        className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30"
                      >
                        <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{studentName}</td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{rollNo}</td>
                        <td className="px-4 py-3">
                          {isEditingResults ? (
                            <input
                              type="number"
                              min="0"
                              max={exam.maxMarks}
                              value={marks}
                              onChange={(e) => handleMarksChange(enrollmentId, e.target.value)}
                              className="w-16 rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
                            />
                          ) : (
                            <span className="font-medium text-gray-900 dark:text-gray-100">{marks}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditingResults ? (
                            <input
                              type="text"
                              value={grade || ''}
                              onChange={(e) => handleGradeChange(enrollmentId, e.target.value)}
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
              <div className="mt-4 flex gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
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
          <p className="text-center text-sm text-gray-500 dark:text-gray-400">
            No results recorded yet
          </p>
        )}
      </Card>
    </div>
  );
}
