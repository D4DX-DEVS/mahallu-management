import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '@/components/layout/Breadcrumb';
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
      setError(err.response?.data?.message || 'Failed to save the class');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            {editing ? 'Edit Class' : 'New Class'}
          </h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Students are enrolled from the class page once it exists
          </p>
        </div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Education', path: '/education' },
            { label: editing ? 'Edit' : 'New' },
          ]}
        />
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="p-3 sm:p-4">
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
                value: employee._id || employee.id,
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
