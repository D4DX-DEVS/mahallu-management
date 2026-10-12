import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import FilterBar from '@/components/ui/FilterBar';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import Avatar from '@/components/ui/Avatar';
import { Pagination as PaginationType } from '@/types';
import { clusterService, Cluster } from '@/services/clusterService';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import PageHeader from '@/components/ui/PageHeader';

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
      setError(getFriendlyError(err, "Couldn't load clusters. Refresh the page or try again."));
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
      toast.error(getFriendlyError(err, "Couldn't create cluster. Check the details and try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Clusters"
        description="Neighbourhood groups of families with a coordinator and team"
        actions={<Button onClick={() => setFormOpen(true)}>+ New cluster</Button>}
      />

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{
            value: searchQuery,
            onChange: (value) => {
              setSearchQuery(value);
              setCurrentPage(1);
            },
            placeholder: 'Search clusters',
          }}
        />

        <div className="p-3.5">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchRows} className="mt-4" variant="secondary">
              Retry
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="No clusters yet" description="Create a cluster to group neighbouring families." />
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            {rows.map((cluster) => (
              <Link key={cluster.id} to={`/clusters/${cluster.id}`}>
                <Card hoverEffect className="h-full p-3 sm:p-4">
                  <div className="flex items-center gap-2">
                    <Avatar size={32} name={cluster.name} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold leading-tight text-[#18231E] dark:text-surface-text sm:text-base">
                        {cluster.name}
                      </p>
                      {cluster.code && (
                        <p className="mt-0.5 text-[0.65rem] text-[#98A59F] sm:text-xs">{cluster.code}</p>
                      )}
                    </div>
                  </div>
                  <dl className="mt-2 space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-xs text-[#7B8983] dark:text-surface-muted">Coordinator</dt>
                      <dd className="flex min-w-0 items-center gap-1.5 truncate text-xs font-semibold text-[#3A4741] dark:text-surface-text">
                        {typeof cluster.coordinatorMemberId === 'object' && cluster.coordinatorMemberId && (
                          <Avatar size={24} name={cluster.coordinatorMemberId.name} src={(cluster.coordinatorMemberId as any).photoUrl} />
                        )}
                        {coordinatorName(cluster)}
                      </dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-xs text-[#7B8983] dark:text-surface-muted">Families</dt>
                      <dd className="text-base font-extrabold text-primary-700 dark:text-surface-text sm:text-xl">
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
          <div className="mt-3.5">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
        </div>
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
        <p className="mt-2 text-xs text-[#7B8983] dark:text-surface-muted">
          Assign the coordinator, team and families from the cluster page after creating it.
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
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
