import { useState, useEffect } from 'react';
import { FiPlus } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import Card from '@/components/ui/Card';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import ExpandableSearch from '@/components/ui/ExpandableSearch';
import { PageSkeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Pagination from '@/components/ui/Pagination';
import { Pagination as PaginationType } from '@/types';
import { mosqueService, MOSQUE_FACILITY_OPTIONS, MosqueProfile } from '@/services/mosqueService';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const emptyForm = {
  name: '',
  nameMl: '',
  capacity: '',
  facilities: [] as string[],
  prayerFacilityNotes: '',
  imamName: '',
  muazzinName: '',
  khateebName: '',
  staffNotes: '',
};

export default function MosquesList() {
  const [rows, setRows] = useState<MosqueProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isConfirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingName, setDeletingName] = useState('');

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchRows();
  }, [debouncedSearch, currentPage]);

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = { page: currentPage, limit: 12 };
      if (debouncedSearch) params.search = debouncedSearch;
      const result = await mosqueService.getAll(params);
      setRows(result.data);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'mosques'));
    } finally {
      setLoading(false);
    }
  };

  const toggleFacility = (value: string) => {
    setForm((prev) => ({
      ...prev,
      facilities: prev.facilities.includes(value)
        ? prev.facilities.filter((f) => f !== value)
        : [...prev.facilities, value],
    }));
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setNameError('Mosque name is required');
      return;
    }
    try {
      setSaving(true);
      await mosqueService.create({
        name: form.name,
        nameMl: form.nameMl || undefined,
        capacity: form.capacity ? Number(form.capacity) : undefined,
        facilities: form.facilities,
        prayerFacilityNotes: form.prayerFacilityNotes || undefined,
        imamName: form.imamName || undefined,
        muazzinName: form.muazzinName || undefined,
        khateebName: form.khateebName || undefined,
        staffNotes: form.staffNotes || undefined,
      });
      setFormOpen(false);
      setForm(emptyForm);
      setNameError(null);
      fetchRows();
      toast.success('Mosque created');
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'create mosque' }));
    } finally {
      setSaving(false);
    }
  };

  const openDeleteConfirm = (mosque: MosqueProfile) => {
    setDeletingId(mosque.id);
    setDeletingName(mosque.name);
    setConfirmDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await mosqueService.remove(deletingId);
      toast.success('Mosque deleted');
      setConfirmDeleteOpen(false);
      setDeletingId(null);
      setDeletingName('');
      fetchRows();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete mosque' }));
    }
  };

  return (
    <div className="space-y-3">
      <PageHeader title="Mosques" description="Capacity, facilities and religious staff for each mosque" />

      {/* No border/padding below `md` here — each mosque/cluster
       * below is already its own bordered card, and a second frame
       * around the whole list drew a box around boxes on a phone. */}
      <TableCard>
        <div className="mb-3 flex min-w-0 items-center gap-2">
          <ExpandableSearch
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value);
              setCurrentPage(1);
            }}
            entity="mosques"
          />
          <Button size="md" onClick={() => setFormOpen(true)} icon={<FiPlus />} collapseLabel>
            New Mosque
          </Button>
        </div>

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="py-10 text-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchRows} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No mosques recorded"
            description="Add the mosques that belong to this Mahallu"
            action={{ label: 'Add First Mosque', onClick: () => setFormOpen(true) }}
          />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((mosque) => (
              <Card key={mosque.id} className="h-full transition-shadow hover:shadow-md">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <Link to={`/mosque/${mosque.id}`} className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold leading-tight text-gray-900 dark:text-gray-100 sm:text-base capitalize">
                      {mosque.name}
                    </p>
                  </Link>
                  <button
                    className="shrink-0 text-xs text-red-600 hover:underline"
                    onClick={() => openDeleteConfirm(mosque)}
                  >
                    Delete
                  </button>
                </div>
                <Link to={`/mosque/${mosque.id}`}>
                  {/* Capacity carries the same weight Clusters gives its
                   * headline stat (Families) - large and semibold, not a line
                   * of small print the same size as its own label. That one
                   * field was what made this card read as smaller. */}
                  <dl className="mt-2 space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Capacity</dt>
                      <dd className="text-base font-semibold text-gray-900 dark:text-gray-100 sm:text-xl">
                        {mosque.capacity ?? '-'}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Imam</dt>
                      <dd className="truncate text-xs font-medium text-gray-700 dark:text-gray-200 capitalize">
                        {mosque.imamName || '-'}
                      </dd>
                    </div>
                  </dl>
                </Link>
              </Card>
            ))}
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
      </TableCard>

      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          setFormOpen(false);
          setForm(emptyForm);
          setNameError(null);
        }}
        title="New Mosque"
        size="lg"
      >
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <Input
              label="Mosque Name"
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                if (nameError) setNameError(null);
              }}
              error={nameError ?? undefined}
              required
            />
          </div>
          <Input
            label="Name (Malayalam)"
            value={form.nameMl}
            onChange={(e) => setForm({ ...form, nameMl: e.target.value })}
            className="font-malayalam"
          />
          <Input
            label="Capacity"
            type="number"
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: e.target.value })}
          />
          <Input
            label="Imam Name"
            value={form.imamName}
            onChange={(e) => setForm({ ...form, imamName: e.target.value })}
          />
          <Input
            label="Muazzin Name"
            value={form.muazzinName}
            onChange={(e) => setForm({ ...form, muazzinName: e.target.value })}
          />
          <Input
            label="Khateeb Name"
            value={form.khateebName}
            onChange={(e) => setForm({ ...form, khateebName: e.target.value })}
          />
          <div className="md:col-span-2">
            <Input
              label="Prayer Facility Notes"
              value={form.prayerFacilityNotes}
              onChange={(e) => setForm({ ...form, prayerFacilityNotes: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <Input
              label="Staff Notes"
              value={form.staffNotes}
              onChange={(e) => setForm({ ...form, staffNotes: e.target.value })}
            />
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Facilities</p>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {MOSQUE_FACILITY_OPTIONS.map((option) => {
              const active = form.facilities.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleFacility(option.value)}
                  className={[
                    'rounded-xl border px-2.5 py-2 text-left text-xs font-medium leading-tight sm:text-sm',
                    active
                      ? 'border-primary-300 bg-primary-50 text-primary-900'
                      : 'border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
                  ].join(' ')}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setFormOpen(false);
              setForm(emptyForm);
              setNameError(null);
            }}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        isLoading={saving}
        isOpen={isConfirmDeleteOpen}
        title="Delete Mosque"
        message={`Delete the mosque "${deletingName}"? Its assets will remain but become unassigned.`}
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
