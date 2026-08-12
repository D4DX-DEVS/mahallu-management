import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import StatCard from '@/components/ui/StatCard';
import SearchInput from '@/components/ui/SearchInput';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
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
      setError(err.response?.data?.message || 'Failed to load relief cases');
    } finally {
      setLoading(false);
    }
  };

  const columns: TableColumn<ReliefCase>[] = [
    { key: 'title', label: 'Case' },
    {
      key: 'familyId',
      label: 'Family',
      render: (v) => (v && typeof v === 'object' ? v.houseName : '-'),
    },
    { key: 'urgency', label: 'Urgency', render: (v) => <UrgencyBadge urgency={v} /> },
    { key: 'amount', label: 'Assistance', render: (v) => (v ? formatCurrency(v) : '-') },
    { key: 'createdAt', label: 'Reported', render: (v) => formatDate(v) },
    { key: 'status', label: 'Status', render: (v) => <ReliefStatusBadge status={v} /> },
  ];

  return (
    <div>
      <Breadcrumb items={[{ label: 'Services' }, { label: 'Emergency Relief' }]} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
            Emergency Relief
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Urgent household needs, from report through assistance.
          </p>
        </div>
        <Button onClick={() => navigate('/relief/create')}>Report a case</Button>
      </div>

      {summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard title="Open cases" value={summary.openCases} />
          <StatCard title="Critical" value={summary.criticalCases} />
          <StatCard title="Assisted" value={summary.assistedCases} />
          <StatCard title="Total given" value={formatCurrency(summary.totalAssistance)} />
        </div>
      )}

      <Card>
        <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
          <SearchInput
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search by case title"
          />
          <Select
            value={urgencyFilter}
            onChange={(e) => {
              setUrgencyFilter(e.target.value);
              setCurrentPage(1);
            }}
            options={URGENCY_FILTER}
          />
        </div>

        <div className="mb-3 grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap">
          {RELIEF_STATUS_TABS.map((tab) => (
            <button
              key={tab.value || 'all'}
              onClick={() => {
                setStatusFilter(tab.value);
                setCurrentPage(1);
              }}
              className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors sm:px-3 sm:text-sm ${
                statusFilter === tab.value
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        <Table
          columns={columns}
          data={rows}
          isLoading={loading}
          emptyMessage="No relief cases yet"
          onRowClick={(row) => navigate(`/relief/${row._id}`)}
        />

        {pagination && pagination.totalPages > 1 && (
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
            onPageChange={setCurrentPage}
          />
        )}
      </Card>
    </div>
  );
}
