import React, { useState, useEffect } from 'react';
import { FiAlertCircle, FiLock, FiPlus, FiTrash2 } from 'react-icons/fi';
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
import { toast } from '@/store/toastStore';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

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
        console.error("Couldn't load resources:", error);
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
      toast.success('Entry deleted');
    } catch (error) {
      toast.error("Couldn't delete record. Please try again.");
      console.error("Couldn't delete resource:", error);
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
      toast.success('Entry added');
    } catch (error) {
      toast.error("Couldn't save record. Please try again.");
      console.error("Couldn't create resource:", error);
      setFormErrors({ name: 'Could not save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (accessDenied) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-md px-4">
          <FiLock className="w-16 h-16 mx-auto text-red-500 mb-4" />
          <PageHeader title={title} />
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <div className="flex gap-2">
              <FiAlertCircle className="text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800 text-sm">
                Access to sensitive health records requires special permission. Please contact your
                administrator to request access to {subtitle}.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-full">
        <PageHeader title={title} description={`${totalItems} ${totalItems === 1 ? 'record' : 'records'}`} />
        <div className="flex gap-3 items-center">
          <Button onClick={() => setShowCreate(true)} icon={<FiPlus />} collapseLabel>Add Record</Button>
        </div>

        <div className="mt-4">
          {resources.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-gray-600 font-medium">No {subtitle} yet</p>
              <p className="text-sm text-gray-500 mt-1 mb-4">
                Add the first record to start tracking {subtitle}.
              </p>
              <Button onClick={() => setShowCreate(true)} icon={<FiPlus />} collapseLabel>Add Record</Button>
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                {resources.map((resource) => (
                  <div key={resource.id} className="rounded-lg border border-border bg-card p-3 sm:p-4">
                    <div className="flex gap-3 items-center">
                      <div className="flex-1">
                        <h3 className="text-base sm:text-lg font-semibold">{toTitleCase(resource.name)}</h3>
                        <p className="text-xs sm:text-sm text-gray-600 mt-1">Contact: {resource.contactNo}</p>
                        {resource.notes && (
                          <p className="text-xs sm:text-sm text-gray-600 mt-2">{resource.notes}</p>
                        )}
                      </div>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => {
                          setDeleteId(resource.id);
                          setConfirmDelete(true);
                        }} icon={<FiTrash2 />} collapseLabel>Delete</Button>
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  itemsPerPage={itemsPerPage}
                  onPageChange={handlePageChange}
                />
              )}
            </>
          )}
        </div>
      </div>

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
              onChange={(e) => setForm({ ...form, contactNo: e.target.value })}
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
        title="Delete Record"
        message="Are you sure you want to delete this record?"
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
