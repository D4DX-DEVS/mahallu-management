import { useState, useEffect } from 'react';
import { FiPlus } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Table from '@/components/ui/Table';
import TableToolbar from '@/components/ui/TableToolbar';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { Pagination as PaginationType, TableColumn } from '@/types';
import { mosqueService, MOSQUE_FACILITY_OPTIONS, MosqueProfile } from '@/services/mosqueService';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

const emptyForm = {
  name: '',
  nameMl: '',
  address: '',
  capacity: '',
  facilities: [] as string[],
  prayerFacilityNotes: '',
  imamName: '',
  muazzinName: '',
  khateebName: '',
  staffNotes: '',
};

export default function MosquesList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<MosqueProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [nameError, setNameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchRows();
  }, [debouncedSearch, currentPage, itemsPerPage]);

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = { page: currentPage, limit: itemsPerPage };
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
        address: form.address || undefined,
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

  const columns: TableColumn<MosqueProfile>[] = [
    {
      key: 'name',
      label: 'Mosque',
      sortable: true,
      width: '16rem',
      render: (name) => <span className="font-medium text-foreground">{toTitleCase(name)}</span>,
    },
    {
      key: 'address',
      label: 'Address',
      sortable: true,
      priority: 'secondary',
      width: '16rem',
      render: (address) => (address ? toTitleCase(address) : '—'),
    },
    {
      key: 'capacity',
      label: 'Capacity',
      align: 'center',
      sortable: true,
      width: '7rem',
      render: (capacity) => <span className="tabular-nums">{capacity ?? '—'}</span>,
    },
    {
      key: 'imamName',
      label: 'Imam',
      sortable: true,
      width: '12rem',
      render: (imam) => (imam ? toTitleCase(imam) : '—'),
    },
  ];

  return (
    <>
      <PageHeader
        title="Mosques"
        description="Capacity, facilities and religious staff for each mosque."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => setFormOpen(true)}>
            New mosque
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
          searchEntity="mosques"
          onRefresh={fetchRows}
        />

        {error ? (
          <EmptyState variant="error" entity="mosques" description={error} action={{ label: 'Try again', onClick: fetchRows }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={rows}
              isLoading={loading}
              entity="mosques"
              emptyVariant={debouncedSearch ? 'no-results' : 'empty'}
              emptyAction={
                debouncedSearch
                  ? {
                      label: 'Clear filters',
                      onClick: () => {
                        setSearchQuery('');
                        setCurrentPage(1);
                      },
                    }
                  : { label: 'Add mosque', onClick: () => setFormOpen(true) }
              }
              onRowClick={(row) => navigate(`/mosque/${row.id}`)}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="mosques"
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
          <div className="md:col-span-2">
            <Input
              label="Address"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
            />
          </div>
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
    </>
  );
}
