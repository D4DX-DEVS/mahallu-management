import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import SearchInput from '@/components/ui/SearchInput';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import { Pagination as PaginationType } from '@/types';
import { clusterService, Cluster } from '@/services/clusterService';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from '@/store/toastStore';

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
      setError(err.response?.data?.message || 'Failed to load clusters');
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
      toast.error(err.response?.data?.message || 'Failed to create cluster');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Clusters</h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Neighbourhood groups of families with a coordinator and team
          </p>
        </div>
        <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Clusters' }]} />
      </div>

      <Card>
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
          <SearchInput
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search clusters..."
          />
          <Button size="md" onClick={() => setFormOpen(true)}>
            + New Cluster
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchRows} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">No clusters yet</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {rows.map((cluster) => (
              <Link key={cluster._id} to={`/clusters/${cluster._id}`}>
                <Card className="h-full p-3 transition-shadow hover:shadow-md sm:p-4">
                  <p className="text-sm font-semibold leading-tight text-gray-900 dark:text-gray-100 sm:text-base">
                    {cluster.name}
                  </p>
                  {cluster.code && (
                    <p className="mt-0.5 text-[0.65rem] text-gray-400 sm:text-xs">{cluster.code}</p>
                  )}
                  <dl className="mt-2 space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Coordinator</dt>
                      <dd className="truncate text-xs font-medium text-gray-700 dark:text-gray-200">
                        {coordinatorName(cluster)}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-xs text-gray-500 dark:text-gray-400">Families</dt>
                      <dd className="text-base font-bold text-gray-900 dark:text-gray-100 sm:text-xl">
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
      </Card>

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
