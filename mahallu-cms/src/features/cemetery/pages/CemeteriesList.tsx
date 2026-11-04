import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import cemeteryService, { Cemetery } from '../../../services/cemeteryService';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import Button from '../../../components/ui/Button';
import Pagination from '../../../components/ui/Pagination';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';
import { TableColumn } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';
import { loadErrorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';

const occupancy = (cemetery: Cemetery) =>
  cemetery.capacity > 0 ? Math.round(((cemetery.usedCount || 0) / cemetery.capacity) * 100) : 0;

export function CemeteriesList() {
  const navigate = useNavigate();
  const [cemeteries, setCemeteries] = useState<Cemetery[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  const debouncedSearch = useDebounce(searchQuery, 300);

  const fetchCemeteries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await cemeteryService.getAllCemeteries(currentPage, itemsPerPage, debouncedSearch);
      setCemeteries(response.data || []);
      setTotalPages(response.pagination?.totalPages || 1);
      setTotalItems(response.pagination?.total || 0);
    } catch (err) {
      setError(loadErrorMessage(err, 'cemeteries'));
      setCemeteries([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearch]);

  useEffect(() => {
    fetchCemeteries();
  }, [fetchCemeteries]);

  const columns: TableColumn<Cemetery>[] = [
    {
      key: 'name',
      label: 'Cemetery',
      sortable: true,
      width: '16rem',
      render: (name, row) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{toTitleCase(name)}</div>
          <div className="truncate text-xs text-muted-foreground">
            {row.location ? toTitleCase(row.location) : 'No location added'}
          </div>
        </div>
      ),
    },
    { key: 'capacity', label: 'Capacity', align: 'center', sortable: true, width: '8rem', render: (v) => <span className="tabular-nums">{v ?? 0}</span> },
    { key: 'usedCount', label: 'Used', align: 'center', sortable: true, priority: 'secondary', width: '8rem', render: (v) => <span className="tabular-nums">{v || 0}</span> },
    {
      key: 'occupancy',
      label: 'Occupancy',
      sortable: false,
      priority: 'secondary',
      width: '12rem',
      render: (_v, row) => (
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-20 flex-shrink-0 overflow-hidden rounded-full bg-subtle">
            <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, occupancy(row))}%` }} />
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">{occupancy(row)}%</span>
        </div>
      ),
    },
    { key: 'status', label: 'Status', sortable: true, width: '8rem', render: (status) => <StatusBadge status={status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Cemeteries"
        description="Manage cemetery records and grave allocations."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => navigate('/cemetery/create')}>
            New cemetery
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
          searchEntity="cemeteries"
          onRefresh={fetchCemeteries}
        />

        {error ? (
          <EmptyState variant="error" entity="cemeteries" description={error} action={{ label: 'Try again', onClick: fetchCemeteries }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={cemeteries}
              isLoading={loading}
              entity="cemeteries"
              emptyVariant={debouncedSearch ? 'no-results' : 'empty'}
              emptyAction={
                debouncedSearch
                  ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); setCurrentPage(1); } }
                  : { label: 'Add cemetery', onClick: () => navigate('/cemetery/create') }
              }
              onRowClick={(row) => navigate(`/cemetery/${row.id}`)}
            />

            <div className="mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                entity="cemeteries"
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(size) => {
                  setItemsPerPage(size);
                  setCurrentPage(1);
                }}
              />
            </div>
          </>
        )}
      </TableCard>
    </>
  );
}
