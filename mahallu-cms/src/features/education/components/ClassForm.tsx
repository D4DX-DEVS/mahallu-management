import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
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
import { fetchAllPages } from '@/services/api';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { useFormValidation } from '@/hooks/useFormValidation';
import { FieldRule, LIMITS } from '@/utils/validation';
import { toTitleCase } from '@/utils/format';

/**
 * The same limits the API applies, so a form that passes here is not
 * refused there. Required matches what each input already declares.
 */
const RULES: Record<string, FieldRule> = {
  name: { label: 'name', required: true, maxLength: LIMITS.title.max },
  nameMl: { label: 'name', maxLength: LIMITS.title.max },
  academicYear: { label: 'academic year', required: true, type: 'academicYear' },
  classType: { label: 'class type', required: true, maxLength: LIMITS.shortText.max },
  teacherEmployeeId: { label: 'teacher employee', type: 'id' },
  schedule: { label: 'schedule', maxLength: LIMITS.shortText.max },
  status: { label: 'status', maxLength: LIMITS.shortText.max },
};

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
  const { errors, validate } = useFormValidation(RULES);

  useEffect(() => {
    fetchAllPages((params) => employeeService.getAll(params) as any)
      .then((rows) => setTeachers(rows))
      .catch(() => setTeachers([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Every field checked at once, each message on its own field.
    if (!validate(form)) return;
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
      setError(errorMessage(err, { action: 'save the class' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <PageHeader
        title={editing ? 'Edit Class' : 'New Class'}
        description="Students are enrolled from the class page once it exists"
        breadcrumbs={[{ label: 'Education', path: '/education' }]}
      />

      <form onSubmit={handleSubmit}>
        <Card>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input
              label="Class name"
              value={form.name}
              error={errors.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Beginners Quran"
              required
            />

            <Input
              label="Class name (Malayalam)"
              value={form.nameMl}
              error={errors.nameMl}
              onChange={(e) => setForm({ ...form, nameMl: e.target.value })}
              placeholder="Optional"
            />

            <Input
              label="Academic year"
              value={form.academicYear}
              error={errors.academicYear}
              onChange={(e) => setForm({ ...form, academicYear: e.target.value })}
              placeholder="2025-26"
              required
            />

            <Select
              label="Class type"
              value={form.classType}
              error={errors.classType}
              onChange={(e) => setForm({ ...form, classType: e.target.value as any })}
              options={CLASS_TYPE_OPTIONS}
              required
            />

            <SearchableSelect
              label="Teacher"
              value={form.teacherEmployeeId}
              error={errors.teacherEmployeeId}
              onChange={(value) => setForm({ ...form, teacherEmployeeId: value })}
              options={teachers.map((employee: any) => ({
                value: employee._id || employee.id,
                label: `${toTitleCase(employee.name)}${employee.designation ? ` - ${toTitleCase(employee.designation)}` : ''}`,
              }))}
              placeholder="Search employees..."
              helperText="Optional"
            />

            <Input
              label="Schedule"
              value={form.schedule}
              error={errors.schedule}
              onChange={(e) => setForm({ ...form, schedule: e.target.value })}
              placeholder="e.g. Sat-Sun 9-11am"
            />

            <Select
              label="Status"
              value={form.status}
              error={errors.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as any })}
              options={CLASS_STATUS_OPTIONS}
            />

            <div className="md:col-span-2">
              <Input
                label="Subjects"
                value={form.subjects}
                error={errors.subjects}
                onChange={(e) => setForm({ ...form, subjects: e.target.value })}
                placeholder="Fiqh, Tajweed, Seerah"
                helperText="Separate each subject with a comma"
              />
            </div>
          </div>

          {error && (
            <div className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
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
