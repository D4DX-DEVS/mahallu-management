import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PersonCell } from '@/components/ui/Avatar';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import StatCard from '@/components/ui/StatCard';
import FilterBar from '@/components/ui/FilterBar';
import Segmented from '@/components/ui/Segmented';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import { Pagination as PaginationType, TableColumn } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';
import { formatCurrency, formatDate } from '@/utils/format';
import {
  reliefService,
  ReliefCase,
  ReliefSummary,
  RELIEF_STATUS_TABS,
  RELIEF_URGENCY_OPTIONS,
} from '@/services/qardService';
import { ReliefStatusBadge, UrgencyBadge } from '../components/LoanStatusBadge';
import { pct } from '@/utils/statSeries';
import RowActions from '@/components/ui/RowActions';
import { getFriendlyError } from '@/utils/apiMessages';

const URGENCY_FILTER = [{ value: '', label: 'Any urgency' }, ...RELIEF_URGENCY_OPTIONS];

export default function ReliefList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ReliefCase[]>([]);
  const [summary, setSummary] = useState<ReliefSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationType | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchRows();
  }, [statusFilter, urgencyFilter, debouncedSearch, currentPage]);

  useEffect(() => {
    reliefService
      .getSummary()
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = { page: currentPage, limit: 10 };
      if (statusFilter) params.status = statusFilter;
      if (urgencyFilter) params.urgency = urgencyFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const result = await reliefService.getCases(params);
      setRows(result.data);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load relief cases. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  const columns: TableColumn<ReliefCase>[] = [
    { key: 'title', label: 'Case' },
    {
      key: 'familyId',
      label: 'Family',
      render: (v) => (v && typeof v === 'object' ? <PersonCell name={v.houseName} /> : '-'),
    },
    { key: 'urgency', label: 'Urgency', render: (v) => <UrgencyBadge urgency={v} /> },
    { key: 'amount', label: 'Assistance', render: (v) => (v ? formatCurrency(v) : '-') },
    { key: 'createdAt', label: 'Reported', render: (v) => formatDate(v) },
    { key: 'status', label: 'Status', render: (v) => <ReliefStatusBadge status={v} /> },
    {
      key: 'actions',
      label: 'Actions',
      hideable: false,
      render: (_v, row) => (
        <RowActions
          onView={() => navigate(`/relief/${row.id}`)}
          ariaLabels={{ view: 'View relief case' }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Emergency Relief"
        description="Urgent household needs, from report through assistance."
        actions={
          <>
            <Button onClick={() => navigate('/relief/create')}>Report a case</Button>
          </>
        }
      />

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard variant="inline" title="Open cases" value={summary.openCases} viz={summary.openCases > 0 ? { type: 'dots', count: summary.openCases } : undefined} summary={`${summary.openCases} relief cases open`} />
          <StatCard variant="inline" title="Critical" value={summary.criticalCases} tone="red" viz={summary.openCases > 0 ? { type: 'ring', percent: pct(summary.criticalCases, summary.openCases), color: '#B3261E' } : undefined} summary={`${summary.criticalCases} of ${summary.openCases} open cases are critical, ${pct(summary.criticalCases, summary.openCases)} percent`} />
          <StatCard variant="inline" title="Assisted" value={summary.assistedCases} />
          <StatCard variant="inline" title="Total given" value={formatCurrency(summary.totalAssistance)} />
        </div>
      )}

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{
            value: searchQuery,
            onChange: (v) => {
              setSearchQuery(v);
              setCurrentPage(1);
            },
            placeholder: 'Search by case title',
          }}
        >
          <div className="w-full sm:w-44">
            <Select
              aria-label="Filter by urgency"
              value={urgencyFilter}
              onChange={(e) => {
                setUrgencyFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={URGENCY_FILTER}
            />
          </div>
          <Segmented
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setCurrentPage(1);
            }}
            options={RELIEF_STATUS_TABS.map((tab) => ({ value: tab.value, label: tab.label }))}
          />
        </FilterBar>

        <div className="p-3.5">
        {error && (
          <Alert tone="danger" className="mb-3.5">{error}</Alert>
        )}

        {!loading && rows.length === 0 ? (
          <EmptyState
            title="No relief cases yet"
            description="Report a case when an emergency arises"
            action={{ label: 'Report a case', onClick: () => navigate('/relief/create') }}
          />
        ) : (
          <Table
            columns={columns}
            data={rows}
            isLoading={loading}
            onRowClick={(row) => navigate(`/relief/${row.id}`)}
          />
        )}

        {pagination && pagination.totalPages > 1 && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
            onPageChange={setCurrentPage}
          />
        )}
        </div>
      </Card>
    </div>
  );
}
