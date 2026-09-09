import { useState, useEffect } from 'react';
import { FiPlus } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import StatCard from '@/components/ui/StatCard';
import ExpandableSearch from '@/components/ui/ExpandableSearch';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import { Pagination as PaginationType, TableColumn } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';
import { formatCurrency, formatDate } from '@/utils/format';
import {
  qardService,
  QardLoan,
  QardSummary,
  LOAN_STATUS_TABS,
  LOAN_PURPOSE_OPTIONS,
  loanApplicantName,
} from '@/services/qardService';
import LoanStatusBadge from '../components/LoanStatusBadge';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

export default function LoansList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<QardLoan[]>([]);
  const [summary, setSummary] = useState<QardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationType | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchRows();
  }, [statusFilter, debouncedSearch, currentPage]);

  useEffect(() => {
    qardService
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
      if (debouncedSearch) params.search = debouncedSearch;
      const result = await qardService.getLoans(params);
      setRows(result.data);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'loans'));
    } finally {
      setLoading(false);
    }
  };

  const columns: TableColumn<QardLoan>[] = [
    { key: 'applicantName', label: 'Applicant', width: '8.25rem', render: (_v, row) => loanApplicantName(row) },
    {
      key: 'purpose',
      label: 'Purpose',
      width: '7.75rem',
      render: (v) => LOAN_PURPOSE_OPTIONS.find((o) => o.value === v)?.label || v,
    },
    {
      key: 'amount',
      label: 'Amount',
      width: '9.25rem',
      align: 'center',
      render: (v, row) => formatCurrency(row.approvedAmount ?? v),
    },
    {
      key: 'outstandingBalance',
      label: 'Outstanding',
      width: '11.25rem',
      align: 'center',
      render: (v) => (v > 0 ? formatCurrency(v) : '-'),
    },
    { key: 'appliedDate', label: 'Applied', width: '7.25rem', render: (v) => formatDate(v) },
    { key: 'status', label: 'Status', width: '7.25rem', render: (v) => <LoanStatusBadge status={v} /> },
  ];

  return (
    <div>
      <PageHeader
        description="Interest-free loans, from application through repayment."
        title="Qard Hasan"
        breadcrumbs={[{ label: 'Services' }]}
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <Button onClick={() => navigate('/loans/create')} icon={<FiPlus />} collapseLabel>New application</Button>
      </div>

      {summary && (
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <StatCard title="Disbursed" value={formatCurrency(summary.totalDisbursed)} />
          <StatCard title="Outstanding" value={formatCurrency(summary.totalOutstanding)} />
          <StatCard title="Repaid" value={formatCurrency(summary.totalRepaid)} />
          <StatCard title="Active loans" value={summary.activeLoans} />
          <StatCard title="Pending" value={summary.pendingApplications} />
        </div>
      )}

      <TableCard>
        <div className="mb-3">
          <ExpandableSearch
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value);
              setCurrentPage(1);
            }}
            entity="loan applications"
            placeholder="Search by applicant name"
          />
        </div>

        <div className="mb-3 grid grid-cols-4 gap-1.5 sm:flex sm:flex-wrap">
          {LOAN_STATUS_TABS.map((tab) => (
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

        {!loading && rows.length === 0 ? (
          <EmptyState
            title="No loan applications yet"
            description="Start by creating a new application"
            action={{ label: 'New application', onClick: () => navigate('/loans/create') }}
          />
        ) : (
          <Table
            fixedLayout
            striped
            columns={columns}
            data={rows}
            isLoading={loading}
            onRowClick={(row) => navigate(`/loans/${row.id}`)}
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
      </TableCard>
    </div>
  );
}
