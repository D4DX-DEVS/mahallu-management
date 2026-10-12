import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PersonCell } from '@/components/ui/Avatar';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import FilterBar from '@/components/ui/FilterBar';
import Segmented from '@/components/ui/Segmented';
import StatusBadge from '@/components/ui/StatusBadge';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/ui/PageHeader';
import SavedViews from '@/components/ui/SavedViews';
import AppliedFilters from '@/components/ui/AppliedFilters';
import TableColumnMenu from '@/components/ui/TableColumnMenu';
import BulkBarButton from '@/components/ui/BulkBarButton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useTableView } from '@/hooks/useTableView';
import { toast } from '@/store/toastStore';
import { FiCheck } from 'react-icons/fi';
import { Pagination as PaginationType, TableColumn } from '@/types';
import { welfareService, WelfareApplication, WelfareSummary, WelfareScheme } from '@/services/welfareService';
import { pct } from '@/utils/statSeries';
import RowActions from '@/components/ui/RowActions';
import { getFriendlyError } from '@/utils/apiMessages';

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'verified', label: 'Verified' },
  { value: 'approved', label: 'Approved' },
  { value: 'disbursed', label: 'Disbursed' },
  { value: 'rejected', label: 'Rejected' },
];

const nameOf = (value: any, key: string) => (typeof value === 'object' && value ? value[key] : '-');

export default function ApplicationsList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<WelfareApplication[]>([]);
  const [summary, setSummary] = useState<WelfareSummary | null>(null);
  const [schemes, setSchemes] = useState<WelfareScheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const filters = useUrlFilters({ status: '', scheme: '' });
  const { page: currentPage, setPage: setCurrentPage } = filters;
  const statusFilter = filters.values.status;
  const schemeFilter = filters.values.scheme;
  const setStatusFilter = (v: string) => filters.setFilter('status', v);
  const setSchemeFilter = (v: string) => filters.setFilter('scheme', v);
  const [bulk, setBulk] = useState<{ action: 'verified' | 'approved'; rows: WelfareApplication[] } | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [selectionKey, setSelectionKey] = useState(0);
  const [pagination, setPagination] = useState<PaginationType | null>(null);

  useEffect(() => {
    fetchRows();
  }, [statusFilter, schemeFilter, currentPage]);

  useEffect(() => {
    welfareService.getSummary().then(setSummary).catch(() => setSummary(null));
    welfareService.getSchemes({ page: 1, limit: 100, status: 'active' })
      .then((result) => setSchemes(result.data))
      .catch(() => setSchemes([]));
  }, []);

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = { page: currentPage, limit: 10 };
      if (statusFilter) params.status = statusFilter;
      if (schemeFilter) params.schemeId = schemeFilter;
      const result = await welfareService.getApplications(params);
      setRows(result.data);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load applications. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  const columns: TableColumn<WelfareApplication>[] = [
    { key: 'schemeId', label: 'Scheme', render: (v) => nameOf(v, 'name') },
    { key: 'familyId', label: 'Family', render: (v) => <PersonCell name={nameOf(v, 'houseName') === '-' ? '' : nameOf(v, 'houseName')} /> },
    { key: 'requestedAmount', label: 'Requested', align: 'right', render: (v) => `Rs ${v ?? 0}` },
    { key: 'approvedAmount', label: 'Approved', align: 'right', render: (v) => (v ? `Rs ${v}` : '-') },
    {
      key: 'priority',
      label: 'Priority',
      render: (v) => (
        <StatusBadge
          status={v}
          tone={v === 'urgent' || v === 'high' ? 'warning' : v === 'medium' ? 'info' : 'neutral'}
        />
      ),
    },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'actions',
      label: 'Actions',
      hideable: false,
      render: (_v, row) => (
        <RowActions
          onView={() => navigate(`/welfare/applications/${row.id}`)}
          ariaLabels={{ view: 'View application' }}
        />
      ),
    },
  ];

  const view = useTableView('welfare-applications', columns);
  const rowsFor = (ids: string[]) => rows.filter((r) => ids.includes(r.id));

  const runBulk = async () => {
    if (!bulk) return;
    setBulkBusy(true);
    const results = await Promise.allSettled(
      bulk.rows.map((r) => welfareService.updateStatus(r.id, { status: bulk.action }))
    );
    const ok = results.filter((x) => x.status === 'fulfilled').length;
    const failed = results.length - ok;
    const label = bulk.action === 'verified' ? 'verified' : 'approved';
    if (ok) toast.success(`${ok} ${ok === 1 ? 'application' : 'applications'} ${label}`);
    if (failed) toast.error(`${failed} could not be ${label}`);
    setBulkBusy(false);
    setBulk(null);
    setSelectionKey((k) => k + 1);
    fetchRows();
    welfareService.getSummary().then(setSummary).catch(() => undefined);
  };

  const summaryCards = [
    { label: 'Total', value: summary?.total ?? 0, viz: summary && summary.total > 0 ? { type: 'segments' as const, segments: [{ value: summary.approved }, { value: summary.pending, color: '#FDD817' }, { value: Math.max(summary.total - summary.approved - summary.pending, 0), color: '#CFE2D8' }] } : undefined, summary: summary ? `Total ${summary.total} applications: ${summary.approved} approved, ${summary.pending} pending` : undefined },
    { label: 'Pending', value: summary?.pending ?? 0, viz: summary && summary.pending > 0 ? { type: 'dots' as const, count: summary.pending } : undefined, summary: `${summary?.pending ?? 0} applications pending` },
    { label: 'Approved', value: summary?.approved ?? 0, viz: summary && summary.total > 0 ? { type: 'ring' as const, percent: pct(summary.approved, summary.total) } : undefined, summary: `Approved ${summary?.approved ?? 0} of ${summary?.total ?? 0} applications, ${pct(summary?.approved ?? 0, summary?.total ?? 0)} percent` },
    { label: 'Disbursed', value: `Rs ${summary?.disbursedAmount ?? 0}` },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Welfare Applications"
        description="Assistance requests and their approval trail"
        actions={
          <>
            <Link to="/welfare/schemes">
              <Button variant="secondary">Schemes</Button>
            </Link>
            <Link to="/welfare/applications/create">
              <Button>+ New Application</Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summaryCards.map((card, i) => (
          <StatCard
            key={card.label}
            variant="tile"
            tone={i === 0 ? 'green' : i === 1 ? 'gold' : i === 2 ? 'lime' : 'neutral'}
            title={card.label}
            value={card.value}
            viz={card.viz}
            summary={card.summary}
          />
        ))}
      </div>

      <Card padding="none" className="overflow-visible">
        <FilterBar actions={<TableColumnMenu {...view.menuProps} />}>
          <Segmented
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setCurrentPage(1);
            }}
            options={STATUS_TABS.map((tab) => ({ value: tab.value, label: tab.label }))}
          />
          <div className="w-full sm:w-44">
            <Select
              aria-label="Filter by scheme"
              options={[
                { value: '', label: 'All schemes' },
                ...schemes.map((s) => ({ value: s.id, label: s.name })),
              ]}
              value={schemeFilter}
              onChange={(e) => {
                setSchemeFilter(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <SavedViews pageKey="welfare-applications" filters={filters} />
        </FilterBar>
        <AppliedFilters
          filters={filters}
          config={{
            status: { label: 'Status', format: (v) => STATUS_TABS.find((t) => t.value === v)?.label ?? v },
            scheme: { label: 'Scheme', format: (v) => schemes.find((s) => s.id === v)?.name ?? v },
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
        ) : rows.length === 0 && filters.activeCount === 0 ? (
          <EmptyState
            title="No applications found"
            description="Create a welfare application to get started"
            action={{
              label: 'Create Application',
              onClick: () => navigate('/welfare/applications/create'),
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table
              key={selectionKey}
              columns={view.columns}
              density={view.density}
              selectable
              getRowId={(row) => row.id}
              filtersActive={filters.activeCount > 0}
              onClearFilters={filters.clear}
              bulkActions={(ids) => {
                const sel = rowsFor(ids);
                const pending = sel.filter((r) => r.status === 'pending');
                const verified = sel.filter((r) => r.status === 'verified');
                return (
                  <>
                    {pending.length > 0 && (
                      <BulkBarButton onClick={() => setBulk({ action: 'verified', rows: pending })}>
                        <FiCheck className="h-3.5 w-3.5" /> Verify ({pending.length})
                      </BulkBarButton>
                    )}
                    {verified.length > 0 && (
                      <BulkBarButton onClick={() => setBulk({ action: 'approved', rows: verified })}>
                        <FiCheck className="h-3.5 w-3.5" /> Approve ({verified.length})
                      </BulkBarButton>
                    )}
                  </>
                );
              }}
              data={rows}
              emptyMessage="No applications found"
              showExport={false}
              onRowClick={(row) => navigate(`/welfare/applications/${row.id}`)}
            />
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

      <ConfirmDialog
        isOpen={!!bulk}
        title={bulk?.action === 'verified' ? 'Verify applications' : 'Approve applications'}
        variant="primary"
        message={`${bulk?.action === 'verified' ? 'Mark' : 'Approve'} ${bulk?.rows.length ?? 0} selected ${bulk?.rows.length === 1 ? 'application' : 'applications'} ${bulk?.action === 'verified' ? 'as verified' : ''}?`}
        consequence={bulk?.action === 'approved' ? 'Each application is approved for its full requested amount.' : 'Only pending applications are included.'}
        confirmLabel={bulk?.action === 'verified' ? 'Verify' : 'Approve'}
        isLoading={bulkBusy}
        onConfirm={runBulk}
        onCancel={() => setBulk(null)}
      />
    </div>
  );
}
