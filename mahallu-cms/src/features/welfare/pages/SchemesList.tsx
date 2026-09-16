import { useState, useEffect } from 'react';
import ActionsMenu from '@/components/ui/ActionsMenu';
import { FiEdit2, FiPlus } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { Pagination as PaginationType, TableColumn } from '@/types';
import { welfareService, WelfareScheme } from '@/services/welfareService';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

export const WELFARE_CATEGORY_OPTIONS = [
  { value: 'medical', label: 'Medical' },
  { value: 'housing', label: 'Housing' },
  { value: 'education', label: 'Education' },
  { value: 'livelihood', label: 'Livelihood' },
  { value: 'food', label: 'Food' },
  { value: 'marriage_assistance', label: 'Marriage Assistance' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'other', label: 'Other' },
];

const emptyForm = { name: '', nameMl: '', category: 'medical', description: '', budgetAmount: 0 };

export default function SchemesList() {
  const [rows, setRows] = useState<WelfareScheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchRows();
  }, [currentPage]);

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await welfareService.getSchemes({ page: currentPage, limit: 10 });
      setRows(result.data);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'schemes'));
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (scheme: WelfareScheme) => {
    setEditingId(scheme.id);
    setForm({
      name: scheme.name || '',
      nameMl: scheme.nameMl || '',
      category: scheme.category || 'medical',
      description: scheme.description || '',
      budgetAmount: scheme.budgetAmount || 0,
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) {
      newErrors.name = 'Scheme name is required';
    }
    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }
    try {
      setSaving(true);
      if (editingId) {
        await welfareService.updateScheme(editingId, form);
        toast.success('Scheme updated');
      } else {
        await welfareService.createScheme(form);
        toast.success('Scheme created');
      }
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      setFieldErrors({});
      fetchRows();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'save scheme' }));
    } finally {
      setSaving(false);
    }
  };

  const columns: TableColumn<WelfareScheme>[] = [
    { key: 'name', label: 'Scheme', width: '7.75rem', render: (v) => <span>{toTitleCase(v)}</span> },
    {
      key: 'category',
      label: 'Category',
      width: '8.25rem',
      render: (v) => WELFARE_CATEGORY_OPTIONS.find((o) => o.value === v)?.label || v,
    },
    { key: 'budgetAmount', label: 'Budget', width: '7.25rem', render: (v) => (v ? `Rs ${v}` : '-') },
    { key: 'status', label: 'Status', width: '7.25rem' },
    {
      key: 'actions',
      label: 'Actions',
      width: '8rem',
      align: 'center',
      render: (_v, row) => (
        <ActionsMenu
          items={[{ label: 'Edit', icon: <FiEdit2 className="h-4 w-4" />, onClick: () => openEdit(row) }]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <PageHeader
        title="Welfare Schemes"
        description="Assistance programmes families can apply to"
        breadcrumbs={[{ label: 'Welfare', path: '/welfare/applications' }]}
      />

      <TableCard>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500 dark:text-gray-400">{pagination?.total ?? 0} scheme(s)</p>
          <Button
            size="md"
            onClick={() => {
              setEditingId(null);
              setForm(emptyForm);
              setFormOpen(true);
            }} icon={<FiPlus />} collapseLabel>New Scheme</Button>
        </div>

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <EmptyState variant="error" entity="schemes" description={error} action={{ label: 'Retry', onClick: fetchRows }} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No schemes yet"
            description="Create a welfare scheme to begin accepting applications"
            action={{
              label: 'Create First Scheme',
              onClick: () => {
                setEditingId(null);
                setForm(emptyForm);
                setFormOpen(true);
              },
            }}
          />
        ) : (
          <Table fixedLayout striped columns={columns} data={rows} emptyMessage="No schemes yet" showExport={false} />
        )}

        {pagination && (
          <div className="mt-4">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </TableCard>

      <Modal
        isOpen={isFormOpen}
        onClose={() => setFormOpen(false)}
        title={editingId ? 'Edit Scheme' : 'New Scheme'}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Input
              label="Scheme Name"
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                if (fieldErrors.name) {
                  setFieldErrors({ ...fieldErrors, name: '' });
                }
              }}
              required
            />
            {fieldErrors.name && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.name}</p>
            )}
          </div>
          <Input
            label="Name (Malayalam)"
            value={form.nameMl}
            onChange={(e) => setForm({ ...form, nameMl: e.target.value })}
            className="font-malayalam"
          />

          <Select
            label="Category"
            options={WELFARE_CATEGORY_OPTIONS}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          <Input
            label="Budget Amount"
            type="number"
            value={String(form.budgetAmount)}
            onChange={(e) => setForm({ ...form, budgetAmount: Number(e.target.value) })}
          />
          <div className="md:col-span-2">
            <Input
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
