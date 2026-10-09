import { useState, useEffect } from 'react';
import { FiList, FiPlus } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import Tabs from '@/components/ui/Tabs';
import StatusBadge from '@/components/ui/StatusBadge';
import FilterPanel from '@/components/ui/FilterPanel';
import TableToolbar from '@/components/ui/TableToolbar';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { Pagination as PaginationType, TableColumn } from '@/types';
import { welfareService, WelfareApplication, WelfareSummary, WelfareScheme } from '@/services/welfareService';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

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
  const [statusFilter, setStatusFilter] = useState('');
  const [schemeFilter, setSchemeFilter] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);

  useEffect(() => {
    fetchRows();
  }, [statusFilter, schemeFilter, currentPage, itemsPerPage]);

  useEffect(() => {
    welfareService
      .getSummary()
      .then(setSummary)
      .catch(() => setSummary(null));
    welfareService
      .getSchemes({ page: 1, limit: 100, status: 'active' })
      .then((result) => setSchemes(result.data))
      .catch(() => setSchemes([]));
  }, []);

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = { page: currentPage, limit: itemsPerPage };
      if (statusFilter) params.status = statusFilter;
      if (schemeFilter) params.schemeId = schemeFilter;
      const result = await welfareService.getApplications(params);
      setRows(result.data);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'applications'));
    } finally {
      setLoading(false);
    }
  };

  const columns: TableColumn<WelfareApplication>[] = [
    {
      key: 'schemeId',
      label: 'Scheme',
      width: '14rem',
      sortable: false,
      render: (v) => <span className="font-medium text-foreground">{toTitleCase(nameOf(v, 'name'))}</span>,
    },
    { key: 'familyId', label: 'Family', width: '12rem', sortable: false, render: (v) => toTitleCase(nameOf(v, 'houseName')) },
    {
      key: 'requestedAmount',
      label: 'Requested',
      align: 'right',
      sortable: true,
      width: '9rem',
      render: (v) => <span className="tabular-nums">₹{(v ?? 0).toLocaleString('en-IN')}</span>,
    },
    {
      key: 'approvedAmount',
      label: 'Approved',
      align: 'right',
      sortable: true,
      priority: 'secondary',
      width: '9rem',
      render: (v) => (v ? <span className="tabular-nums">₹{v.toLocaleString('en-IN')}</span> : '—'),
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      priority: 'secondary',
      width: '8rem',
      render: (v) => (v ? toTitleCase(v) : '—'),
    },
    { key: 'status', label: 'Status', sortable: true, width: '8rem', render: (v) => <StatusBadge status={v} /> },
  ];

  const summaryCards = [
    { title: 'Total', value: summary?.total ?? 0 },
    { title: 'Pending', value: summary?.pending ?? 0 },
    { title: 'Approved', value: summary?.approved ?? 0 },
    { title: 'Disbursed', value: `₹${(summary?.disbursedAmount ?? 0).toLocaleString('en-IN')}` },
  ];

  const isFiltered = Boolean(statusFilter || schemeFilter);

  return (
    <>
      <PageHeader
        title="Welfare applications"
        description="Assistance requests and their approval trail."
        actions={
          <>
            <Link to="/welfare/schemes">
              <Button variant="outline" icon={<FiList />} collapseLabel>
                Schemes
              </Button>
            </Link>
            <Link to="/welfare/applications/create">
              <Button icon={<FiPlus />} collapseLabel>
                New application
              </Button>
            </Link>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      <TableCard>
        <TableToolbar
          tabs={
            <Tabs
              variant="segmented"
              ariaLabel="Application status"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}
              items={STATUS_TABS}
            />
          }
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={schemeFilter ? 1 : 0}
          onRefresh={fetchRows}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-64">
              <Select
                label="Scheme"
                options={[
                  { value: '', label: 'All schemes' },
                  ...schemes.map((s) => ({ value: s.id, label: toTitleCase(s.name) })),
                ]}
                value={schemeFilter}
                onChange={(e) => {
                  setSchemeFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            {schemeFilter && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSchemeFilter('');
                  setCurrentPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterPanel>
        )}

        {error ? (
          <EmptyState variant="error" entity="applications" description={error} action={{ label: 'Try again', onClick: fetchRows }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={rows}
              isLoading={loading}
              entity="applications"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? {
                      label: 'Clear filters',
                      onClick: () => {
                        setStatusFilter('');
                        setSchemeFilter('');
                        setCurrentPage(1);
                      },
                    }
                  : { label: 'Add application', onClick: () => navigate('/welfare/applications/create') }
              }
              onRowClick={(row) => navigate(`/welfare/applications/${row.id}`)}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="applications"
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
