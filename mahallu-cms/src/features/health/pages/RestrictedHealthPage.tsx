import { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import {
  getSensitiveHealthResources,
  deleteSensitiveHealthResource,
  createSensitiveHealthResource,
  IHealthResource,
} from '@/services/healthService';
import Pagination from '@/components/ui/Pagination';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import Table from '@/components/ui/Table';
import ActionsMenu from '@/components/ui/ActionsMenu';
import EmptyState from '@/components/ui/EmptyState';
import { TableColumn } from '@/types';
import { loadErrorMessage } from '@/utils/errors';
import { toast } from '@/store/toastStore';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import { PHONE_PATTERN, sanitizeDigits } from '@/utils/validation';

interface RestrictedHealthPageProps {
  title: string;
  type: 'palliative_case' | 'patient_support';
  subtitle: string;
}

export default function RestrictedHealthPage({ title, type, subtitle }: RestrictedHealthPageProps) {
  const [resources, setResources] = useState<IHealthResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [accessDenied, setAccessDenied] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ name: '', contactNo: '', availability: '', notes: '' });
  const [formErrors, setFormErrors] = useState<{ name?: string; contactNo?: string }>({});

  const fetchResources = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getSensitiveHealthResources(currentPage, itemsPerPage, type);
      setResources(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
      setAccessDenied(false);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setAccessDenied(true);
        setResources([]);
      } else {
        setError(loadErrorMessage(err, 'records'));
      }
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, type]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleting(true);
      await deleteSensitiveHealthResource(deleteId);
      setConfirmDelete(false);
      setDeleteId(null);
      fetchResources();
      toast.success('Entry deleted');
    } catch (error) {
      toast.error("Couldn't delete record. Please try again.");
      console.error("Couldn't delete resource:", error);
    } finally {
      setDeleting(false);
    }
  };

  const handleCreate = async () => {
    const errs: typeof formErrors = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.contactNo.trim()) errs.contactNo = 'Contact number is required';
    else if (!PHONE_PATTERN.test(form.contactNo.trim())) errs.contactNo = 'Please enter a 10-digit phone number.';
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      setSaving(true);
      await createSensitiveHealthResource({
        type,
        name: form.name.trim(),
        contactNo: form.contactNo.trim(),
        availability: form.availability.trim() || undefined,
        notes: form.notes.trim() || undefined,
        status: 'active',
      });
      setShowCreate(false);
      setForm({ name: '', contactNo: '', availability: '', notes: '' });
      setCurrentPage(1);
      fetchResources();
      toast.success('Entry added');
    } catch (error) {
      toast.error("Couldn't save record. Please try again.");
      console.error("Couldn't create resource:", error);
      setFormErrors({ name: 'Could not save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const columns: TableColumn<IHealthResource>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      width: '16rem',
      render: (name) => <span className="font-medium text-foreground">{toTitleCase(name)}</span>,
    },
    { key: 'contactNo', label: 'Contact', sortable: false, width: '10rem', render: (v) => <span className="tabular-nums">{v || '—'}</span> },
    { key: 'availability', label: 'Availability', sortable: false, priority: 'secondary', width: '14rem', render: (v) => v || '—' },
    { key: 'notes', label: 'Notes', sortable: false, priority: 'tertiary', width: '20rem', render: (v) => v || '—' },
    {
      key: 'actions',
      label: '',
      align: 'right',
      sortable: false,
      width: '6.5rem',
      render: (_v, resource) => (
        <ActionsMenu
          label={`Actions for ${toTitleCase(resource.name)}`}
          items={[
            {
              label: 'Delete',
              icon: <FiTrash2 className="h-4 w-4" />,
              variant: 'danger',
              onClick: () => {
                setDeleteId(resource.id);
                setConfirmDelete(true);
              },
            },
          ]}
        />
      ),
    },
  ];

  if (accessDenied) {
    return (
      <>
        <PageHeader title={title} description={`Restricted ${subtitle}.`} />
        <EmptyState
          variant="no-access"
          title="You need permission to view this"
          description={`Access to sensitive health records requires special permission. Please contact your administrator to request access to ${subtitle}.`}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={title}
        description={`Restricted ${subtitle}.`}
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => setShowCreate(true)}>
            Add record
          </Button>
        }
      />

      <TableCard>
        <TableToolbar onRefresh={fetchResources} />

        {error ? (
          <EmptyState variant="error" entity="records" description={error} action={{ label: 'Try again', onClick: fetchResources }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={resources}
              isLoading={loading}
              entity="records"
              emptyAction={{ label: 'Add record', onClick: () => setShowCreate(true) }}
            />

            <div className="mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                entity="records"
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(size) => {
                  setItemsPerPage(size);
                  setCurrentPage(1);
                }}
              />
            </div>
          </>
        )}
      </TableCard>

      <Modal isOpen={showCreate} title={`Add ${title}`} onClose={() => setShowCreate(false)}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Name *</label>
            <input
              aria-label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              placeholder="Patient or case name"
            />
            {formErrors.name && <p className="mt-1 text-label text-red-600">{formErrors.name}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Contact Number *</label>
            <input
              aria-label="Contact Number"
              value={form.contactNo}
              onChange={(e) => setForm({ ...form, contactNo: sanitizeDigits(e.target.value, 10) })}
              type="tel"
              inputMode="numeric"
              maxLength={10}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              placeholder="Phone number"
            />
            {formErrors.contactNo && <p className="mt-1 text-label text-red-600">{formErrors.contactNo}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Availability / Frequency</label>
            <input
              aria-label="Availability / Frequency"
              value={form.availability}
              onChange={(e) => setForm({ ...form, availability: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              placeholder="e.g. Weekly home visit"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              aria-label="Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded"
              placeholder="Condition, care needs, family contact..."
            />
          </div>
          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-3">
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? 'Saving...' : 'Save Record'}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete this record?"
        message="This permanently removes the record and cannot be undone."
        consequence="It is a sensitive health record."
        confirmLabel="Delete record"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setConfirmDelete(false);
          setDeleteId(null);
        }}
      />
    </>
  );
}
