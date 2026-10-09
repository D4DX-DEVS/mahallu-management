import { useState, useEffect } from 'react';
import ActionsMenu from '@/components/ui/ActionsMenu';
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import FilterPanel from '@/components/ui/FilterPanel';
import TableToolbar from '@/components/ui/TableToolbar';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Pagination from '@/components/ui/Pagination';
import { Pagination as PaginationType, TableColumn } from '@/types';
import { facilityService, LocalityFacility } from '@/services/surveyService';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import { PHONE_PATTERN, sanitizeDigits } from '@/utils/validation';

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
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isConfirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [viewing, setViewing] = useState<LocalityFacility | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchRows();
  }, [debouncedSearch, typeFilter, currentPage, itemsPerPage]);

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = { page: currentPage, limit: itemsPerPage };
      if (debouncedSearch) params.search = debouncedSearch;
      if (typeFilter) params.type = typeFilter;
      const result = await facilityService.getAll(params);
      setRows(result.data);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'facilities'));
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
    setEditingId(facility.id);
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
    if (form.contactNo && !PHONE_PATTERN.test(form.contactNo)) {
      newErrors.contactNo = 'Please enter a 10-digit phone number.';
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
      toast.error(errorMessage(err, { action: 'save facility' }));
    } finally {
      setSaving(false);
    }
  };

  const openDeleteConfirm = (facility: LocalityFacility) => {
    setDeletingId(facility.id);
    setDeletingName(facility.name);
    setConfirmDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      setIsDeleting(true);
      await facilityService.remove(deletingId);
      toast.success('Facility deleted');
      setConfirmDeleteOpen(false);
      setDeletingId(null);
      setDeletingName('');
      fetchRows();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete facility' }));
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: TableColumn<LocalityFacility>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      width: '14rem',
      render: (v) => <span className="font-medium text-foreground">{toTitleCase(v)}</span>,
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      width: '10rem',
      render: (v) => TYPE_OPTIONS.find((option) => option.value === v)?.label || v || '—',
    },
    { key: 'address', label: 'Address', priority: 'secondary', width: '16rem', render: (v) => (v ? toTitleCase(v) : '—') },
    { key: 'contactNo', label: 'Contact', priority: 'secondary', width: '8rem', render: (v) => v || '—' },
    {
      key: 'actions',
      label: '',
      width: '6.5rem',
      align: 'right',
      sortable: false,
      render: (_v, row) => (
        <ActionsMenu
          label={`Actions for ${toTitleCase(row.name)}`}
          items={[
            { label: 'Edit', icon: <FiEdit2 className="h-4 w-4" />, onClick: () => openEdit(row) },
            {
              label: 'Delete',
              icon: <FiTrash2 className="h-4 w-4" />,
              onClick: () => openDeleteConfirm(row),
              variant: 'danger' as const,
            },
          ]}
        />
      ),
    },
  ];

  const isFiltered = Boolean(debouncedSearch || typeFilter);

  return (
    <>
      <PageHeader
        title="Locality facilities"
        description="Schools, hospitals and institutions serving the mahallu."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={openCreate}>
            New facility
          </Button>
        }
      />

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={(value) => {
            setSearchQuery(value);
            setCurrentPage(1);
          }}
          searchEntity="facilities"
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={typeFilter ? 1 : 0}
          onRefresh={fetchRows}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-52">
              <Select
                label="Type"
                options={[{ value: '', label: 'All types' }, ...TYPE_OPTIONS]}
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            {typeFilter && (
              <Button
                variant="ghost"
                onClick={() => {
                  setTypeFilter('');
                  setCurrentPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterPanel>
        )}

        {error ? (
          <EmptyState variant="error" entity="facilities" description={error} action={{ label: 'Try again', onClick: fetchRows }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={rows}
              isLoading={loading}
              entity="facilities"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? {
                      label: 'Clear filters',
                      onClick: () => {
                        setSearchQuery('');
                        setTypeFilter('');
                        setCurrentPage(1);
                      },
                    }
                  : { label: 'Add facility', onClick: openCreate }
              }
              onRowClick={(row) => setViewing(row)}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="facilities"
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(size) => {
                    setItemsPerPage(size);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
          </>
        )}
      </TableCard>

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
            label="Type"
            options={TYPE_OPTIONS}
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
          />
          <div>
            <Input
              label="Contact No."
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={form.contactNo}
              onChange={(e) => {
                setForm({ ...form, contactNo: sanitizeDigits(e.target.value, 10) });
                if (fieldErrors.contactNo) {
                  setFieldErrors({ ...fieldErrors, contactNo: '' });
                }
              }}
            />
            {fieldErrors.contactNo && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{fieldErrors.contactNo}</p>
            )}
          </div>
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

      <Modal
        isOpen={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title="Facility Details"
        footer={
          <>
            <Button variant="outline" onClick={() => setViewing(null)}>
              Close
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (viewing) openEdit(viewing);
                setViewing(null);
              }}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (viewing) openDeleteConfirm(viewing);
                setViewing(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        {viewing && (
          <div className="space-y-3">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Name</span>
              <p className="text-gray-900 dark:text-gray-100">{toTitleCase(viewing.name)}</p>
            </div>
            {viewing.nameMl && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Name (Malayalam)</span>
                <p className="font-malayalam text-gray-900 dark:text-gray-100">{viewing.nameMl}</p>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Type</span>
              <p className="text-gray-900 dark:text-gray-100">
                {TYPE_OPTIONS.find((option) => option.value === viewing.type)?.label || viewing.type || '-'}
              </p>
            </div>
            {viewing.address && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Address</span>
                <p className="text-gray-900 dark:text-gray-100">{toTitleCase(viewing.address)}</p>
              </div>
            )}
            {viewing.contactNo && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Contact No.</span>
                <p className="text-gray-900 dark:text-gray-100">{viewing.contactNo}</p>
              </div>
            )}
            {viewing.notes && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Notes</span>
                <p className="text-gray-900 dark:text-gray-100">{viewing.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isLoading={isDeleting}
        isOpen={isConfirmDeleteOpen}
        title={`Delete ${deletingName ? toTitleCase(deletingName) : 'this facility'}?`}
        message="This permanently removes the facility and cannot be undone."
        variant="danger"
        confirmLabel="Delete facility"
        onConfirm={confirmDelete}
        onCancel={() => {
          setConfirmDeleteOpen(false);
          setDeletingId(null);
          setDeletingName('');
        }}
      />
    </>
  );
}
