import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { toast } from '@/store/toastStore';
import { examService } from '@/services/attendanceService';
import { madrasaService, MadrasaClass } from '@/services/madrasaService';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import Input from '@/components/ui/Input';
import { useFormValidation } from '@/hooks/useFormValidation';
import { FieldRule, LIMITS } from '@/utils/validation';

/**
 * The same limits the API applies, so a form that passes here is not
 * refused there. Required matches what each input already declares.
 */
const RULES: Record<string, FieldRule> = {
  classId: { label: 'class', required: true, type: 'id' },
  name: { label: 'name', required: true, maxLength: LIMITS.title.max },
  examDate: { label: 'exam date', required: true, type: 'date' },
  maxMarks: { label: 'maximum marks', required: true, type: 'integer', min: 1, max: 10000 },
  status: { label: 'status', maxLength: LIMITS.shortText.max },
};

export default function ExamCreate() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialClassId = searchParams.get('classId') || '';

  const [classes, setClasses] = useState<MadrasaClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    classId: initialClassId,
    name: '',
    examDate: new Date().toISOString().split('T')[0],
    maxMarks: 100,
    status: 'scheduled' as const,
  });
  const { errors, validate } = useFormValidation(RULES);

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const result = await madrasaService.getClasses({ limit: 100 });
      setClasses(result.data);
    } catch (err: any) {
      toast.error("Couldn't load classes. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'maxMarks' ? parseInt(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Every field checked at once, each message on its own field.
    if (!validate(formData)) return;

    if (!formData.classId || !formData.name || !formData.examDate) {
      toast.error('Please fill in all the required fields.');
      return;
    }

    try {
      setSubmitting(true);
      const exam = await examService.createExam(formData);
      toast.success(`Exam "${formData.name}" created`);
      navigate(`/education/exams/${exam.id}`);
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'create exam' }));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <PageSkeleton />;

  return (
    <div>
      <PageHeader
        description="Add a new exam to a class"
        title="New exam"
        breadcrumbs={[{ label: 'Services' }, { label: 'Education', path: '/education' }]}
      />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Class *</label>
            <select
              aria-label="Class"
              name="classId"
              value={formData.classId}
              onChange={handleChange}
              required
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="">Select a class</option>
              {classes.map((cls) => (
                <option key={cls.id} value={cls.id}>
                  {cls.name} ({cls.academicYear})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Exam Name *
            </label>
            <input
              aria-label="Exam Name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              placeholder="e.g., Midterm Exam 2025"
              required
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Exam date"
              type="date"
              name="examDate"
              value={formData.examDate}
              error={errors.examDate}
              onChange={handleChange}
              required
            />

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Max Marks *
              </label>
              <input
                aria-label="Max Marks"
                type="number"
                name="maxMarks"
                value={formData.maxMarks}
                onChange={handleChange}
                min="1"
                required
                className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
            <select
              aria-label="Status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700 dark:text-white"
            >
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-4 dark:border-gray-700">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating...' : 'Create exam'}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/education')}
              disabled={submitting}
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
