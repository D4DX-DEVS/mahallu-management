import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { examService } from '@/services/attendanceService';
import { madrasaService, MadrasaClass } from '@/services/madrasaService';

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

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const result = await madrasaService.getClasses({ limit: 100 });
      setClasses(result.data);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't load classes. Try again in a moment."));
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

    if (!formData.classId || !formData.name || !formData.examDate) {
      toast.error('Fill in the required fields to continue');
      return;
    }

    try {
      setSubmitting(true);
      const exam = await examService.createExam(formData);
      toast.success(`Exam "${formData.name}" created`);
      navigate(`/education/exams/${exam.id}`);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create exam. Check the details and try again."));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <PageHeader title="Create exam" description="Add a new exam to a class" />

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Exam details</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Class, date and marking scheme</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Select
                label="Class"
                name="classId"
                value={formData.classId}
                onChange={handleChange}
                required
                options={[
                  { value: '', label: 'Select a class' },
                  ...classes.map((cls) => ({ value: cls.id, label: `${cls.name} (${cls.academicYear})` })),
                ]}
              />
            </div>

            <div className="md:col-span-2">
              <Input
                label="Exam Name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="e.g., Midterm Exam 2025"
                required
              />
            </div>

            <Input
              label="Exam Date"
              type="date"
              name="examDate"
              value={formData.examDate}
              onChange={handleChange}
              required
            />

            <Input
              label="Max Marks"
              type="number"
              name="maxMarks"
              value={formData.maxMarks}
              onChange={handleChange}
              min="1"
              required
            />

            <Select
              label="Status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              options={[
                { value: 'scheduled', label: 'Scheduled' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
            />
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate('/education')} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Creating...' : 'Create exam'}
          </Button>
        </div>
      </form>
    </div>
  );
}
