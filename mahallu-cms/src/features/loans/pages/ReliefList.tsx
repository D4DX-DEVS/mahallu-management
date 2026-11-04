import { useState, useEffect } from 'react';
import { FiPlus } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import StatCard from '@/components/ui/StatCard';
import Tabs from '@/components/ui/Tabs';
import FilterPanel from '@/components/ui/FilterPanel';
import TableToolbar from '@/components/ui/TableToolbar';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
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
import { loadErrorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';
import PageHeader from '@/components/layout/PageHeader';

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
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchRows();
  }, [statusFilter, urgencyFilter, debouncedSearch, currentPage, itemsPerPage]);

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
      const params: Record<string, any> = { page: currentPage, limit: itemsPerPage };
      if (statusFilter) params.status = statusFilter;
      if (urgencyFilter) params.urgency = urgencyFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const result = await reliefService.getCases(params);
      setRows(result.data);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'relief cases'));
    } finally {
      setLoading(false);
    }
  };

  const columns: TableColumn<ReliefCase>[] = [
    {
      key: 'title',
      label: 'Case',
      sortable: true,
      width: '16rem',
      render: (v) => <span className="font-medium text-foreground">{v}</span>,
    },
    {
      key: 'familyId',
      label: 'Family',
      sortable: false,
      width: '12rem',
      render: (v) => (v && typeof v === 'object' ? toTitleCase(v.houseName) : '—'),
    },
    { key: 'urgency', label: 'Urgency', sortable: true, width: '8rem', render: (v) => <UrgencyBadge urgency={v} /> },
    {
      key: 'amount',
      label: 'Assistance',
      align: 'right',
      sortable: true,
      priority: 'secondary',
      width: '9rem',
      render: (v) => (v ? formatCurrency(v) : '—'),
    },
    { key: 'createdAt', label: 'Reported', sortable: true, priority: 'secondary', width: '9rem', render: (v) => formatDate(v) },
    { key: 'status', label: 'Status', sortable: true, width: '8rem', render: (v) => <ReliefStatusBadge status={v} /> },
  ];

  const isFiltered = Boolean(statusFilter || urgencyFilter || debouncedSearch);

  return (
    <>
      <PageHeader
        title="Emergency relief"
        description="Urgent household needs, from report through assistance."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => navigate('/relief/create')}>
            Report a case
          </Button>
        }
      />

      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="Open cases" value={summary.openCases} />
          <StatCard title="Critical" value={summary.criticalCases} />
          <StatCard title="Assisted" value={summary.assistedCases} />
          <StatCard title="Total given" value={formatCurrency(summary.totalAssistance)} />
        </div>
      )}

      <TableCard>
        <TableToolbar
          tabs={
            <Tabs
              variant="segmented"
              ariaLabel="Case status"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}
              items={RELIEF_STATUS_TABS}
            />
          }
          searchQuery={searchQuery}
          onSearchChange={(value) => {
            setSearchQuery(value);
            setCurrentPage(1);
          }}
          searchEntity="relief cases"
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={urgencyFilter ? 1 : 0}
          onRefresh={fetchRows}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-52">
              <Select
                label="Urgency"
                value={urgencyFilter}
                onChange={(e) => {
                  setUrgencyFilter(e.target.value);
                  setCurrentPage(1);
                }}
                options={URGENCY_FILTER}
              />
            </div>
            {urgencyFilter && (
              <Button
                variant="ghost"
                onClick={() => {
                  setUrgencyFilter('');
                  setCurrentPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterPanel>
        )}

        {error ? (
          <EmptyState variant="error" entity="relief cases" description={error} action={{ label: 'Try again', onClick: fetchRows }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={rows}
              isLoading={loading}
              entity="relief cases"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? {
                      label: 'Clear filters',
                      onClick: () => {
                        setSearchQuery('');
                        setStatusFilter('');
                        setUrgencyFilter('');
                        setCurrentPage(1);
                      },
                    }
                  : { label: 'Report a case', onClick: () => navigate('/relief/create') }
              }
              onRowClick={(row) => navigate(`/relief/${row.id}`)}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="relief cases"
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
    </>
  );
}
