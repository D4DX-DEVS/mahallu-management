import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import cemeteryService, { Cemetery, GraveRecord } from '../../../services/cemeteryService';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import PageHeader from '../../../components/ui/PageHeader';
import FilterBar from '../../../components/ui/FilterBar';
import StatCard from '../../../components/ui/StatCard';
import Alert from '../../../components/ui/Alert';
import Table from '../../../components/ui/Table';
import RowActions from '../../../components/ui/RowActions';
import Avatar, { PersonCell } from '../../../components/ui/Avatar';
import EmptyState from '../../../components/ui/EmptyState';
import { TableColumn } from '@/types';
import Pagination from '../../../components/ui/Pagination';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { FiPlus, FiMap, FiCheckSquare, FiSquare } from 'react-icons/fi';
import { pct } from '@/utils/statSeries';

export function CemeteryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cemetery, setCemetery] = useState<Cemetery | null>(null);
  const [graves, setGraves] = useState<GraveRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteGraveId, setDeleteGraveId] = useState<string | null>(null);
  const itemsPerPage = 10;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch cemetery and graves
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        const [cemeteryData, gravesData] = await Promise.all([
          cemeteryService.getCemeteryById(id!),
          cemeteryService.getCemeteryGraves(id!, currentPage, itemsPerPage, debouncedSearch),
        ]);
        setCemetery(cemeteryData);
        setGraves(gravesData.data || []);
        setTotalPages(gravesData.pagination?.totalPages || 1);
        setTotalItems(gravesData.pagination?.total || 0);
      } catch (err: any) {
        setError(getFriendlyError(err, "Couldn't load cemetery. Refresh the page or try again."));
      } finally {
        setLoading(false);
      }
    };

    if (id) fetchData();
  }, [id, currentPage, debouncedSearch]);

  const handleDeleteGrave = async () => {
    if (!deleteGraveId) return;
    try {
      await cemeteryService.deleteGraveRecord(deleteGraveId);
      setGraves(graves.filter((g) => g.id !== deleteGraveId));
      toast.success('Grave record deleted');
      setConfirmDelete(false);
      setDeleteGraveId(null);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't delete grave. Try again in a moment."));
      setConfirmDelete(false);
      setDeleteGraveId(null);
    }
  };

  if (loading && !cemetery) {
    return <LoadingSpinner />;
  }

  if (!cemetery) {
    return <Alert tone="danger">Cemetery not found</Alert>;
  }

  const columns: TableColumn<GraveRecord>[] = [
    { key: 'graveNo', label: 'Grave No', render: (v) => <span className="font-semibold">{v}</span> },
    { key: 'deceasedName', label: 'Deceased Name', render: (v) => (v ? <PersonCell name={v} size={32} /> : '—') },
    {
      key: 'dateOfDeath',
      label: 'Date of Death',
      render: (v) => (v ? new Date(v).toLocaleDateString() : '—'),
    },
    { key: 'rowLabel', label: 'Row', render: (v) => v || '—' },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, grave) => (
        <RowActions
          onEdit={() => navigate(`/cemetery/${id}/grave/${grave.id}/edit`)}
          onDelete={() => {
            setDeleteGraveId(grave.id!);
            setConfirmDelete(true);
          }}
          ariaLabels={{ edit: 'Edit grave', delete: 'Delete grave' }}
        />
      ),
    },
  ];

  const occupancy = Math.round(((cemetery.usedCount || 0) / cemetery.capacity) * 100);

  return (
    <div className="space-y-4">
      <PageHeader
        leading={<Avatar size={56} name={cemetery.name} />}
        title={cemetery.name}
        description={cemetery.location}
        actions={
          <Button variant="secondary" onClick={() => navigate('/cemetery')}>
            Back
          </Button>
        }
      />

      {error && <Alert tone="danger">{error}</Alert>}

      {/* Cemetery info cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard variant="inline" title="Capacity" value={cemetery.capacity} icon={<FiMap className="h-[17px] w-[17px]" />} tone="green" />
        <StatCard variant="inline" viz={(cemetery.capacity || 0) > 0 ? { type: 'ring', percent: pct(cemetery.usedCount || 0, cemetery.capacity || 0), color: '#E0B400' } : undefined} summary={`${cemetery.usedCount || 0} of ${cemetery.capacity || 0} plots used`} title="Used" value={cemetery.usedCount || 0} icon={<FiCheckSquare className="h-[17px] w-[17px]" />} tone="lime" />
        <StatCard
          variant="inline"
          title="Available"
          viz={(cemetery.capacity || 0) > 0 ? { type: 'bullet', percent: pct((cemetery.capacity || 0) - (cemetery.usedCount || 0), cemetery.capacity || 0), target: 100 } : undefined}
          summary={`${(cemetery.capacity || 0) - (cemetery.usedCount || 0)} of ${cemetery.capacity || 0} plots available`}
          value={(cemetery.capacity || 0) - (cemetery.usedCount || 0)}
          icon={<FiSquare className="h-[17px] w-[17px]" />}
          tone="neutral"
        />
      </div>

      {/* Occupancy bar */}
      <Card padding="lg">
        <div className="mb-2.5 text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Occupancy</div>
        <div className="h-2 w-full overflow-hidden rounded-md bg-[#E7EEEA] dark:bg-surface-raised">
          <div
            className="h-full rounded-md bg-progress-brand transition-all"
            style={{
              width: `${Math.min(100, ((cemetery.usedCount || 0) / cemetery.capacity) * 100)}%`,
            }}
          />
        </div>
        <div className="mt-2 text-xs text-[#5B6963] dark:text-surface-muted">{occupancy}% full</div>
      </Card>

      {cemetery.notes && (
        <Card padding="lg">
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Notes</div>
          <p className="text-[13px] text-[#18231E] dark:text-surface-text">{cemetery.notes}</p>
        </Card>
      )}

      {/* Graves section */}
      <Card padding="none" className="overflow-visible">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-soft px-3.5 py-3 dark:border-surface-border">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Graves</h2>
          <Button size="sm" onClick={() => navigate(`/cemetery/${id}/grave/create`)}>
            <FiPlus className="h-3.5 w-3.5" /> Add grave
          </Button>
        </div>
        <FilterBar search={{ value: search, onChange: setSearch, placeholder: 'Search by grave number or deceased name' }} />

        <div className="p-3.5">
          {graves.length === 0 ? (
            <EmptyState
              title={debouncedSearch ? 'No graves found matching search' : 'No graves recorded yet'}
              description={debouncedSearch ? 'Try a different grave number or name.' : 'Add the first grave to this cemetery.'}
            />
          ) : (
            <Table columns={columns} data={graves} showExport={false} />
          )}

          {totalPages > 1 && (
            <div className="mt-3.5">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="Delete grave?"
        message="Delete this grave record? This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeleteGrave}
        onCancel={() => {
          setConfirmDelete(false);
          setDeleteGraveId(null);
        }}
      />
    </div>
  );
}
