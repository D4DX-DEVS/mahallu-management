import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import {
  madrasaService,
  MadrasaClass,
  CLASS_TYPE_OPTIONS,
  CLASS_STATUS_OPTIONS,
  currentAcademicYear,
} from '@/services/madrasaService';
import { employeeService } from '@/services/employeeService';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

interface ClassFormProps {
  /** Omitted when creating. */
  existing?: MadrasaClass;
}

const refId = (value: unknown): string => {
  if (value && typeof value === 'object') return (value as { id: string }).id;
  return typeof value === 'string' ? value : '';
};

/** Subjects are a free list; a comma-separated field beats a bespoke widget here. */
const splitSubjects = (raw: string): string[] =>
  raw
    .split(',')
    .map((subject) => subject.trim())
    .filter(Boolean);

export default function ClassForm({ existing }: ClassFormProps) {
  const navigate = useNavigate();
  const editing = Boolean(existing);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: existing?.name || '',
    nameMl: existing?.nameMl || '',
    academicYear: existing?.academicYear || currentAcademicYear(),
    classType: existing?.classType || 'weekend_madrasa',
    teacherEmployeeId: refId(existing?.teacherEmployeeId),
    subjects: (existing?.subjects || []).join(', '),
    schedule: existing?.schedule || '',
    status: existing?.status || 'active',
  });

  useEffect(() => {
    employeeService
      .getAll({ page: 1, limit: 200 })
      .then((result: any) => setTeachers(result.data || []))
      .catch(() => setTeachers([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Give the class a name');
      return;
    }
    if (!form.academicYear.trim()) {
      setError('Enter the academic year');
      return;
    }

    const payload = {
      name: form.name,
      nameMl: form.nameMl || undefined,
      academicYear: form.academicYear,
      classType: form.classType,
      teacherEmployeeId: form.teacherEmployeeId || undefined,
      subjects: splitSubjects(form.subjects),
      schedule: form.schedule || undefined,
      status: form.status,
    };

    try {
      setSaving(true);
      if (existing) {
        await madrasaService.updateClass(existing.id, payload);
        navigate(`/education/classes/${existing.id}`);
      } else {
        const created = await madrasaService.createClass(payload);
        navigate(`/education/classes/${created.id}`);
      }
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't save the class. Check the details and try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={editing ? 'Edit class' : 'New class'}
        description="Students are enrolled from the class page once it exists"
      />

      <form onSubmit={handleSubmit}>
        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Class details</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Name, type, teacher and schedule</p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Class name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Beginners Quran"
              required
            />

            <Input
              label="Class name (Malayalam)"
              value={form.nameMl}
              onChange={(e) => setForm({ ...form, nameMl: e.target.value })}
              placeholder="Optional"
            />

            <Input
              label="Academic year"
              value={form.academicYear}
              onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
              placeholder="2025-26"
              required
            />

            <Select
              label="Class type"
              value={form.classType}
              onChange={(e) => setForm({ ...form, classType: e.target.value as any })}
              options={CLASS_TYPE_OPTIONS}
              required
            />

            <SearchableSelect
              label="Teacher"
              value={form.teacherEmployeeId}
              onChange={(value) => setForm({ ...form, teacherEmployeeId: value })}
              options={teachers.map((employee: any) => ({
                value: employee.id,
                label: `${employee.name}${employee.designation ? ` - ${employee.designation}` : ''}`,
              }))}
              placeholder="Search employees..."
              helperText="Optional"
            />

            <Input
              label="Schedule"
              value={form.schedule}
              onChange={(e) => setForm({ ...form, schedule: e.target.value })}
              placeholder="e.g. Sat-Sun 9-11am"
            />

            <Select
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as any })}
              options={CLASS_STATUS_OPTIONS}
            />

            <div className="md:col-span-2">
              <Input
                label="Subjects"
                value={form.subjects}
                onChange={(e) => setForm({ ...form, subjects: e.target.value })}
                placeholder="Fiqh, Tajweed, Seerah"
                helperText="Separate each subject with a comma"
              />
            </div>
          </div>

          {error && (
            <Alert tone="danger" className="mt-3">
              {error}
            </Alert>
          )}

          <div className="mt-4 flex flex-col gap-2 border-t border-line-soft pt-4 dark:border-surface-border sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(existing ? `/education/classes/${existing.id}` : '/education')}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Class'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
