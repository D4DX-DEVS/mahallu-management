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
import { clusterService, Cluster } from '@/services/clusterService';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

const emptyForm = { name: '', nameMl: '', code: '', notes: '' };

const coordinatorName = (cluster: Cluster) =>
  typeof cluster.coordinatorMemberId === 'object' && cluster.coordinatorMemberId
    ? cluster.coordinatorMemberId.name
    : '-';

export default function ClustersList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
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

  const columns: TableColumn<Cluster>[] = [
    {
      key: 'name',
      label: 'Cluster',
      sortable: true,
      width: '16rem',
      render: (name, row) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{toTitleCase(name)}</div>
          {row.code && <div className="truncate text-xs text-muted-foreground">{row.code}</div>}
        </div>
      ),
    },
    {
      key: 'coordinatorMemberId',
      label: 'Coordinator',
      sortable: false,
      width: '14rem',
      render: (_v, row) => toTitleCase(coordinatorName(row)),
    },
    {
      key: 'familyCount',
      label: 'Families',
      align: 'center',
      sortable: true,
      width: '7rem',
      render: (count) => <span className="tabular-nums">{count ?? 0}</span>,
    },
  ];

  return (
    <>
      <PageHeader
        title="Clusters"
        description="Neighbourhood groups of families with a coordinator and team."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => setFormOpen(true)}>
            New cluster
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
          searchEntity="clusters"
          onRefresh={fetchRows}
        />

        {error ? (
          <EmptyState variant="error" entity="clusters" description={error} action={{ label: 'Try again', onClick: fetchRows }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={rows}
              isLoading={loading}
              entity="clusters"
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
                  : { label: 'Add cluster', onClick: () => setFormOpen(true) }
              }
              onRowClick={(row) => navigate(`/clusters/${row.id}`)}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="clusters"
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
    </>
  );
}
