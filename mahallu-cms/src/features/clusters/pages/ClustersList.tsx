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
import Pagination from '@/components/ui/Pagination';
import { Pagination as PaginationType } from '@/types';
import { clusterService, Cluster } from '@/services/clusterService';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const emptyForm = { name: '', nameMl: '', code: '', notes: '' };

const coordinatorName = (cluster: Cluster) =>
  typeof cluster.coordinatorMemberId === 'object' && cluster.coordinatorMemberId
    ? cluster.coordinatorMemberId.name
    : '-';

export default function ClustersList() {
  const [rows, setRows] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

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
      const result = await clusterService.getAll(params);
      setRows(result.data);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'clusters'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setNameError('Cluster name is required');
      return;
    }
    try {
      setSaving(true);
      await clusterService.create(form);
      setFormOpen(false);
      setForm(emptyForm);
      setNameError(null);
      fetchRows();
      toast.success('Cluster created');
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'create cluster' }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <PageHeader
        title="Clusters"
        description="Neighbourhood groups of families with a coordinator and team"
      />

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
            entity="clusters"
          />
          <Button size="md" onClick={() => setFormOpen(true)} icon={<FiPlus />} collapseLabel>
            New Cluster
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
          <p className="py-10 text-center text-sm text-gray-500 dark:text-gray-400">No clusters yet</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((cluster) => (
              <Link key={cluster.id} to={`/clusters/${cluster.id}`}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <p className="text-sm font-semibold leading-tight text-gray-900 dark:text-gray-100 sm:text-base capitalize">
                    {cluster.name}
                  </p>
                  {cluster.code && <p className="mt-0.5 text-xs text-gray-400 sm:text-xs">{cluster.code}</p>}
                  <dl className="mt-2 space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Coordinator</dt>
                      <dd className="truncate text-xs font-medium text-gray-700 dark:text-gray-200 capitalize">
                        {coordinatorName(cluster)}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Families</dt>
                      <dd className="text-base font-semibold text-gray-900 dark:text-gray-100 sm:text-xl">
                        {cluster.familyCount ?? 0}
                      </dd>
                    </div>
                  </dl>
                </Card>
              </Link>
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

      <Modal isOpen={isFormOpen} onClose={() => setFormOpen(false)} title="New Cluster">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            label="Cluster Name"
            value={form.name}
            onChange={(e) => {
              setForm({ ...form, name: e.target.value });
              if (nameError) setNameError(null);
            }}
            error={nameError ?? undefined}
            required
          />
          <Input
            label="Name (Malayalam)"
            value={form.nameMl}
            onChange={(e) => setForm({ ...form, nameMl: e.target.value })}
            className="font-malayalam"
          />
          <Input
            label="Code"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            placeholder="CL-01"
          />
          <Input
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Assign the coordinator, team and families from the cluster page after creating it.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
