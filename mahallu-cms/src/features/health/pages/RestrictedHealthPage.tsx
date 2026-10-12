import { useState, useEffect } from 'react';
import { FiLock } from 'react-icons/fi';
import {
  getSensitiveHealthResources,
  deleteSensitiveHealthResource,
  createSensitiveHealthResource,
  IHealthResource,
} from '@/services/healthService';
import Pagination from '@/components/ui/Pagination';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import StatusBadge from '@/components/ui/StatusBadge';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { TableColumn } from '@/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

interface RestrictedHealthPageProps {
  title: string;
  type: 'palliative_case' | 'patient_support';
  subtitle: string;
}

export default function RestrictedHealthPage({ title, type, subtitle }: RestrictedHealthPageProps) {
  const [resources, setResources] = useState<IHealthResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [accessDenied, setAccessDenied] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({ name: '', contactNo: '', availability: '', notes: '' });
  const [formErrors, setFormErrors] = useState<{ name?: string; contactNo?: string }>({});

  const itemsPerPage = 10;

  const fetchResources = async (page: number) => {
    try {
      setLoading(true);
      const response = await getSensitiveHealthResources(page, itemsPerPage, type);
      setResources(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
      setCurrentPage(response.pagination.page);
      setAccessDenied(false);
    } catch (error: any) {
      if (error.response?.status === 403) {
        setAccessDenied(true);
        setResources([]);
      } else {
        console.error('Failed to fetch resources:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources(1);
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      setDeleting(true);
      await deleteSensitiveHealthResource(deleteId);
      setConfirmDelete(false);
      setDeleteId(null);
      fetchResources(currentPage);
      toast.success('Record deleted');
    } catch (error) {
      toast.error(getFriendlyError(error, "Couldn't delete record. Try again in a moment."));
      console.error('Failed to delete resource:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handlePageChange = (page: number) => {
    fetchResources(page);
  };

  const handleCreate = async () => {
    const errs: typeof formErrors = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (!form.contactNo.trim()) errs.contactNo = 'Contact number is required';
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
      fetchResources(1);
      toast.success('Record added');
    } catch (error) {
      toast.error(getFriendlyError(error, "Couldn't save record. Check the details and try again."));
      console.error('Failed to create resource:', error);
      setFormErrors({ name: "Couldn't save the record. Check the details and try again." });
    } finally {
      setSaving(false);
    }
  };

  const columns: TableColumn<IHealthResource>[] = [
    { key: 'name', label: 'Name', render: (v) => <PersonCell name={v} size={32} /> },
    { key: 'contactNo', label: 'Contact' },
    { key: 'availability', label: 'Availability', render: (v) => v || '-' },
    { key: 'notes', label: 'Notes', render: (v) => <span className="line-clamp-1 max-w-[320px] text-xs text-[#5B6963] dark:text-surface-muted">{v || '-'}</span> },
    { key: 'status', label: 'Status', render: (v) => (v ? <StatusBadge status={v} /> : '-') },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, resource) => (
        <RowActions
          onDelete={() => {
            setDeleteId(resource.id);
            setConfirmDelete(true);
          }}
          ariaLabels={{ delete: 'Delete record' }}
        />
      ),
    },
  ];

  if (accessDenied) {
    return (
      <div className="space-y-4">
        <PageHeader title={title} />
        <Card className="flex flex-col items-center py-10 text-center">
          <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FDECEA] text-[#B3261E] dark:bg-red-500/15 dark:text-red-300">
            <FiLock className="h-6 w-6" />
          </span>
          <Alert tone="warning" className="max-w-md text-left">
            Access to sensitive health records requires special permission. Please contact your administrator to request access to {subtitle}.
          </Alert>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={title}
        description={`${totalItems} records`}
        actions={<Button onClick={() => setShowCreate(true)}>+ Add record</Button>}
      />

      <Card padding="none">
        <div className="p-3.5">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : resources.length === 0 ? (
            <EmptyState
              title={`No ${subtitle} yet`}
              description={`Add the first record to start tracking ${subtitle}.`}
              action={{ label: '+ Add Record', onClick: () => setShowCreate(true) }}
            />
          ) : (
            <>
              <Table columns={columns} data={resources} showExport={false} />

              {totalPages > 1 && (
                <div className="mt-3.5">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    itemsPerPage={itemsPerPage}
                    onPageChange={handlePageChange}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      <Modal isOpen={showCreate} title={`Add ${title}`} description="Record is stored with restricted access" onClose={() => setShowCreate(false)}>
        <div className="space-y-4">
          <Input
            label="Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Patient or case name"
            error={formErrors.name}
          />
          <Input
            label="Contact Number *"
            value={form.contactNo}
            onChange={(e) => setForm({ ...form, contactNo: e.target.value })}
            placeholder="Phone number"
            error={formErrors.contactNo}
          />
          <Input
            label="Availability / Frequency"
            value={form.availability}
            onChange={(e) => setForm({ ...form, availability: e.target.value })}
            placeholder="e.g. Weekly home visit"
          />
          <div>
            <label htmlFor="health-notes" className={labelClasses}>Notes</label>
            <textarea
              id="health-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              className={`${controlClasses} py-2`}
              placeholder="Condition, care needs, family contact..."
            />
          </div>
          <div className="flex justify-end gap-2.5">
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
        title="Delete record?"
        message="This record will be deleted. This cannot be undone."
        consequence="This sensitive record will be permanently removed from the system."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setConfirmDelete(false);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
