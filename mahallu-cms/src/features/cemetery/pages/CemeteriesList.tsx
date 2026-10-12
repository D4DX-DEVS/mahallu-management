import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import cemeteryService, { Cemetery } from '../../../services/cemeteryService';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import RowActions from '../../../components/ui/RowActions';
import PageHeader from '../../../components/ui/PageHeader';
import FilterBar from '../../../components/ui/FilterBar';
import StatusBadge from '../../../components/ui/StatusBadge';
import Alert from '../../../components/ui/Alert';
import EmptyState from '../../../components/ui/EmptyState';
import Pagination from '../../../components/ui/Pagination';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import ConfirmDialog from '../../../components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { FiPlus } from 'react-icons/fi';

export function CemeteriesList() {
  const navigate = useNavigate();
  const [cemeteries, setCemeteries] = useState<Cemetery[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const itemsPerPage = 10;

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch cemeteries
  useEffect(() => {
    const fetchCemeteries = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await cemeteryService.getAllCemeteries(
          currentPage,
          itemsPerPage,
          debouncedSearch
        );
        setCemeteries(response.data || []);
        setTotalPages(response.pagination?.totalPages || 1);
        setTotalItems(response.pagination?.total || 0);
      } catch (err: any) {
        setError(getFriendlyError(err, "Couldn't load cemeteries. Refresh the page or try again."));
        setCemeteries([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCemeteries();
  }, [currentPage, debouncedSearch]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await cemeteryService.deleteCemetery(deleteId);
      setCemeteries(cemeteries.filter((c) => c.id !== deleteId));
      toast.success('Cemetery deleted');
      setConfirmDelete(false);
      setDeleteId(null);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't delete cemetery. Try again in a moment."));
      setConfirmDelete(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Cemeteries"
        description="Manage cemetery records and grave allocations"
        actions={
          <Button onClick={() => navigate('/cemetery/create')}>
            <FiPlus className="h-3.5 w-3.5" /> Create cemetery
          </Button>
        }
      />

      <Card padding="none" className="overflow-visible">
        <FilterBar search={{ value: search, onChange: setSearch, placeholder: 'Search cemeteries' }} />

        <div className="p-3.5">
          {error && (
            <Alert tone="danger" className="mb-3">
              {error}
            </Alert>
          )}

          {loading ? (
            <LoadingSpinner />
          ) : cemeteries.length === 0 ? (
            <EmptyState title="No cemeteries found" description="Try adjusting your search or create a cemetery." />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cemeteries.map((cemetery) => (
                <Card
                  key={cemetery.id}
                  hoverEffect
                  className="cursor-pointer"
                  onClick={() => navigate(`/cemetery/${cemetery.id}`)}
                >
                  <div className="space-y-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-[13px] font-bold text-[#18231E] dark:text-surface-text">
                          {cemetery.name}
                        </h3>
                        {cemetery.location && (
                          <p className="mt-0.5 truncate text-xs text-[#7B8983] dark:text-surface-muted">
                            {cemetery.location}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={cemetery.status} size="sm" />
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-[#7B8983] dark:text-surface-muted">Capacity</span>
                        <span className="font-bold">{cemetery.capacity}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[#7B8983] dark:text-surface-muted">Used</span>
                        <span className="font-bold">{cemetery.usedCount || 0}</span>
                      </div>
                      {cemetery.capacity > 0 && (
                        <div className="flex justify-between">
                          <span className="text-[#7B8983] dark:text-surface-muted">Occupancy</span>
                          <span className="font-bold">
                            {Math.round(
                              ((cemetery.usedCount || 0) / cemetery.capacity) * 100
                            )}%
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Occupancy bar */}
                    <div className="h-1.5 w-full rounded-md bg-[#E7EEEA] dark:bg-surface-raised">
                      <div
                        className="h-full rounded-md bg-progress-brand transition-all"
                        style={{
                          width: `${Math.min(100, ((cemetery.usedCount || 0) / cemetery.capacity) * 100)}%`,
                        }}
                      />
                    </div>

                    <div className="flex justify-end border-t border-line-soft pt-3 dark:border-surface-border">
                      <RowActions
                        onView={() => navigate(`/cemetery/${cemetery.id}`)}
                        onEdit={() => navigate(`/cemetery/${cemetery.id}/edit`)}
                        onDelete={() => {
                          setDeleteId(cemetery.id!);
                          setConfirmDelete(true);
                        }}
                        viewLabel="View"
                        ariaLabels={{ view: `View ${cemetery.name}`, edit: `Edit ${cemetery.name}`, delete: `Delete ${cemetery.name}` }}
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
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
        title="Delete cemetery?"
        message="Delete this cemetery? This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => {
          setConfirmDelete(false);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
