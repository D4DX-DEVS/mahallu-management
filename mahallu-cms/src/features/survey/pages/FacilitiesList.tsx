import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import SearchInput from '@/components/ui/SearchInput';
import { PageSkeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Pagination from '@/components/ui/Pagination';
import { Pagination as PaginationType, TableColumn } from '@/types';
import { facilityService, LocalityFacility } from '@/services/surveyService';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from '@/store/toastStore';

const TYPE_OPTIONS = [
  { value: 'school', label: 'School' },
  { value: 'college', label: 'College' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'religious_institution', label: 'Religious Institution' },
  { value: 'public_institution', label: 'Public Institution' },
  { value: 'library', label: 'Library' },
  { value: 'organization', label: 'Organization' },
  { value: 'public_space', label: 'Public Space' },
  { value: 'business', label: 'Business' },
  { value: 'other', label: 'Other' },
];

const emptyForm = {
  name: '',
  nameMl: '',
  type: 'school',
  address: '',
  contactNo: '',
  notes: '',
};

export default function FacilitiesList() {
  const [rows, setRows] = useState<LocalityFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isConfirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string>('');

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchRows();
  }, [debouncedSearch, typeFilter, currentPage]);

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = { page: currentPage, limit: 10 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (typeFilter) params.type = typeFilter;
      const result = await facilityService.getAll(params);
      setRows(result.data);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load facilities');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (facility: LocalityFacility) => {
    setEditingId(facility._id);
    setForm({
      name: facility.name || '',
      nameMl: facility.nameMl || '',
      type: facility.type || 'school',
      address: facility.address || '',
      contactNo: facility.contactNo || '',
      notes: facility.notes || '',
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    const newErrors: Record<string, string> = {};
    if (!form.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      return;
    }
    try {
      setSaving(true);
      if (editingId) {
        await facilityService.update(editingId, form);
        toast.success('Facility updated');
      } else {
        await facilityService.create(form);
        toast.success('Facility created');
      }
      setFormOpen(false);
      setFieldErrors({});
      fetchRows();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save facility');
    } finally {
      setSaving(false);
    }
  };

  const openDeleteConfirm = (facility: LocalityFacility) => {
    setDeletingId(facility._id);
    setDeletingName(facility.name);
    setConfirmDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await facilityService.remove(deletingId);
      toast.success('Facility deleted');
      setConfirmDeleteOpen(false);
      setDeletingId(null);
      setDeletingName('');
      fetchRows();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete facility');
    }
  };

  const columns: TableColumn<LocalityFacility>[] = [
    { key: 'name', label: 'Name' },
    {
      key: 'type',
      label: 'Type',
      render: (v) => TYPE_OPTIONS.find((option) => option.value === v)?.label || v || '-',
    },
    { key: 'address', label: 'Address', render: (v) => v || '-' },
    { key: 'contactNo', label: 'Contact', render: (v) => v || '-' },
    {
      key: 'actions',
      label: 'Actions',
      render: (_v, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button className="text-primary-600 hover:underline" onClick={() => openEdit(row)}>
            Edit
          </button>
          <button className="text-red-600 hover:underline" onClick={() => openDeleteConfirm(row)}>
            Delete
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Locality Facilities</h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Schools, hospitals and institutions serving the Mahallu
          </p>
        </div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Survey', path: '/survey' },
            { label: 'Facilities' },
          ]}
        />
      </div>

      <Card>
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-center">
          <SearchInput
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search facilities..."
          />
          <Select
            options={[{ value: '', label: 'All types' }, ...TYPE_OPTIONS]}
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
          />
          <Button size="md" onClick={openCreate}>
            + New Facility
          </Button>
        </div>

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchRows} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No facilities recorded"
            description="Add locality facilities like schools, hospitals, and institutions"
            action={{
              label: 'Add First Facility',
              onClick: openCreate,
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table columns={columns} data={rows} emptyMessage="No facilities recorded" showExport={false} />
          </div>
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
      </Card>

      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          setFormOpen(false);
          setFieldErrors({});
        }}
        title={editingId ? 'Edit Facility' : 'New Facility'}
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                if (fieldErrors.name) {
                  setFieldErrors({ ...fieldErrors, name: '' });
                }
              }}
              required
            />
            {fieldErrors.name && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.name}</p>}
          </div>
          <Input
            label="Name (Malayalam)"
            value={form.nameMl}
            onChange={(e) => setForm({ ...form, nameMl: e.target.value })}
            className="font-malayalam"
          />
          <Select
            label="Type"
            options={TYPE_OPTIONS}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          />
          <Input
            label="Contact No."
            value={form.contactNo}
            onChange={(e) => setForm({ ...form, contactNo: e.target.value })}
          />
          <div className="md:col-span-2">
            <Input
              label="Address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <Input
              label="Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setFormOpen(false);
              setFieldErrors({});
            }}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={isConfirmDeleteOpen}
        title="Delete Facility"
        message={`Delete the facility "${deletingName}"?`}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onCancel={() => {
          setConfirmDeleteOpen(false);
          setDeletingId(null);
          setDeletingName('');
        }}
      />
    </div>
  );
}
