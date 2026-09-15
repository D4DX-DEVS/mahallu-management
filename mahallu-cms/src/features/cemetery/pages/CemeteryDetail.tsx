import { useState, useEffect } from 'react';
import StatCard from '@/components/ui/StatCard';
import { useParams, useNavigate } from 'react-router-dom';
import cemeteryService, { Cemetery, GraveRecord } from '../../../services/cemeteryService';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import Pagination from '../../../components/ui/Pagination';
import { PageSkeleton } from '@/components/ui/Skeleton';
import ExpandableSearch from '@/components/ui/ExpandableSearch';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { FiPlus, FiEdit2, FiTrash2, FiArrowLeft } from 'react-icons/fi';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import SortableTh from '@/components/ui/SortableTh';
import { useSortableRows } from '@/hooks/useSortableRows';

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
  const [confirmDeleteCemetery, setConfirmDeleteCemetery] = useState(false);
  const [deletingCemetery, setDeletingCemetery] = useState(false);
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
        setError(loadErrorMessage(err, 'cemetery'));
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
      toast.error(errorMessage(err, { action: 'delete grave' }));
      setConfirmDelete(false);
      setDeleteGraveId(null);
    }
  };

  const handleDeleteCemetery = async () => {
    if (!id) return;
    try {
      setDeletingCemetery(true);
      await cemeteryService.deleteCemetery(id);
      navigate('/cemetery');
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete cemetery' }));
      setDeletingCemetery(false);
    }
  };

  const {
    rows: sortedGraves,
    sort,
    toggleSort,
  } = useSortableRows(graves);

  if (loading && !cemetery) {
    return <PageSkeleton />;
  }

  if (!cemetery) {
    return (
      <div className="text-center py-10">
        <div className="text-red-500">Cemetery not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate('/cemetery')} className="flex items-center gap-2">
          <FiArrowLeft /> Back
        </Button>
        <div className="flex-1">
          <PageHeader title={toTitleCase(cemetery.name)} />
          {cemetery.location && <p className="text-sm text-gray-600">{toTitleCase(cemetery.location)}</p>}
        </div>
        <span
          className={`inline-block px-2 py-1 text-xs font-medium rounded-full ${
            cemetery.status === 'active'
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}
        >
          {cemetery.status || 'active'}
        </span>
        <div className="flex gap-2 items-center">
          <Button
            variant="outline"
            onClick={() => navigate(`/cemetery/${id}/edit`)}
            icon={<FiEdit2 />}
            collapseLabel
          >
            Edit
          </Button>
          <Button
            variant="danger"
            onClick={() => setConfirmDeleteCemetery(true)}
            icon={<FiTrash2 />}
            collapseLabel
          >
            Delete
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      {/* Cemetery info cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard title="Capacity" value={cemetery.capacity} />
        <StatCard title="Used" value={cemetery.usedCount || 0} />
        <StatCard title="Available" value={(cemetery.capacity || 0) - (cemetery.usedCount || 0)} />
      </div>

      {/* Occupancy bar */}
      <Card>
        <div className="text-sm text-gray-600 mb-3">Occupancy</div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-blue-500 h-3 rounded-full transition-all"
            style={{
              width: `${Math.min(100, ((cemetery.usedCount || 0) / cemetery.capacity) * 100)}%`,
            }}
          />
        </div>
        <div className="text-sm text-gray-600 mt-2">
          {Math.round(((cemetery.usedCount || 0) / cemetery.capacity) * 100)}% full
        </div>
      </Card>

      {cemetery.notes && (
        <Card>
          <div className="text-sm text-gray-600 mb-2">Notes</div>
          <p className="text-gray-900">{cemetery.notes}</p>
        </Card>
      )}

      {/* Graves section */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-semibold">Graves</h2>
          <Button
            onClick={() => navigate(`/cemetery/${id}/grave/create`)}
            className="flex items-center gap-2 w-full sm:w-auto justify-center"
          >
            <FiPlus /> Add Grave
          </Button>
        </div>

        <ExpandableSearch
          value={search}
          onChange={(value) => setSearch(value)}
          entity="graves"
          placeholder="Search by grave number or deceased name"
        />

        {graves.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            {debouncedSearch ? 'No graves found matching search' : 'No graves recorded yet'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <SortableTh sortKey="graveNo" sort={sort} onSort={toggleSort} className="p-3">
                    Grave No
                  </SortableTh>
                  <SortableTh sortKey="deceasedName" sort={sort} onSort={toggleSort} className="p-3">
                    Deceased Name
                  </SortableTh>
                  <SortableTh
                    sortKey="dateOfDeath"
                    sort={sort}
                    onSort={toggleSort}
                    className="p-3"
                    responsiveClassName="hidden sm:table-cell"
                  >
                    Date of Death
                  </SortableTh>
                  <SortableTh
                    sortKey="rowLabel"
                    sort={sort}
                    onSort={toggleSort}
                    className="p-3"
                    responsiveClassName="hidden md:table-cell"
                  >
                    Row
                  </SortableTh>
                  <th className="p-3 text-right text-label font-semibold text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedGraves.map((grave) => (
                  <tr key={grave.id} className="border-b hover:bg-gray-50">
                    <td className="p-3 text-sm font-medium">{grave.graveNo}</td>
                    <td className="p-3 text-sm">{toTitleCase(grave.deceasedName)}</td>
                    <td className="p-3 text-sm hidden sm:table-cell text-gray-600">
                      {grave.dateOfDeath ? new Date(grave.dateOfDeath).toLocaleDateString() : '—'}
                    </td>
                    <td className="p-3 text-sm hidden md:table-cell text-gray-600">
                      {grave.rowLabel || '—'}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex gap-2 flex-col-reverse items-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/cemetery/${id}/grave/${grave.id}/edit`)}
                          className="text-xs"
                        >
                          <FiEdit2 className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs text-red-600 hover:text-red-700"
                          onClick={() => {
                            setDeleteGraveId(grave.id!);
                            setConfirmDelete(true);
                          }}
                        >
                          <FiTrash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={totalItems}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        )}
      </div>

      <ConfirmDialog
        isLoading={loading}
        isOpen={confirmDelete}
        title="Delete Grave"
        message="Delete this grave record? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeleteGrave}
        onCancel={() => {
          setConfirmDelete(false);
          setDeleteGraveId(null);
        }}
      />

      <ConfirmDialog
        isLoading={deletingCemetery}
        isOpen={confirmDeleteCemetery}
        title="Delete Cemetery"
        message={`Delete "${toTitleCase(cemetery.name)}"? This action cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDeleteCemetery}
        onCancel={() => setConfirmDeleteCemetery(false)}
      />
    </div>
  );
}
