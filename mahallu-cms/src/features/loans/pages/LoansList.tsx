import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import StatCard from '@/components/ui/StatCard';
import FilterBar from '@/components/ui/FilterBar';
import Segmented from '@/components/ui/Segmented';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
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
import { PersonCell } from '@/components/ui/Avatar';
import LoanStatusBadge from '../components/LoanStatusBadge';
import { pct } from '@/utils/statSeries';
import RowActions from '@/components/ui/RowActions';
import StatusBadge from '@/components/ui/StatusBadge';
import { getFriendlyError } from '@/utils/apiMessages';

const applicantPhoto = (loan: QardLoan): string | undefined =>
  loan.applicantMemberId && typeof loan.applicantMemberId === 'object'
    ? (loan.applicantMemberId as { photoUrl?: string }).photoUrl
    : undefined;

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
      setError(getFriendlyError(err, "Couldn't load loans. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  const columns: TableColumn<QardLoan>[] = [
    { key: 'applicantName', label: 'Applicant', render: (_v, row) => <PersonCell name={loanApplicantName(row) === '-' ? '' : loanApplicantName(row)} src={applicantPhoto(row)} /> },
    {
      key: 'purpose',
      label: 'Purpose',
      render: (v) => (v ? <StatusBadge status={v} label={LOAN_PURPOSE_OPTIONS.find((o) => o.value === v)?.label || String(v)} tone="neutral" dot={false} /> : '-'),
    },
    {
      key: 'amount',
      label: 'Amount',
      render: (v, row) => formatCurrency(row.approvedAmount ?? v),
    },
    {
      key: 'outstandingBalance',
      label: 'Outstanding',
      render: (v) => (v > 0 ? formatCurrency(v) : '-'),
    },
    { key: 'appliedDate', label: 'Applied', render: (v) => formatDate(v) },
    { key: 'status', label: 'Status', render: (v) => <LoanStatusBadge status={v} /> },
    {
      key: 'actions',
      label: 'Actions',
      hideable: false,
      render: (_v, row) => (
        <RowActions
          onView={() => navigate(`/loans/${row.id}`)}
          ariaLabels={{ view: 'View loan' }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Qard Hasan"
        description="Interest-free loans, from application through repayment."
        actions={
          <>
            <Button onClick={() => navigate('/loans/create')}>New application</Button>
          </>
        }
      />

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <StatCard variant="inline" title="Disbursed" value={formatCurrency(summary.totalDisbursed)} viz={summary.totalRepaid + summary.totalOutstanding > 0 ? { type: 'segments', segments: [{ value: summary.totalRepaid }, { value: summary.totalOutstanding, color: '#E0B400' }] } : undefined} summary={`Disbursed ${formatCurrency(summary.totalDisbursed)}: ${formatCurrency(summary.totalRepaid)} repaid, ${formatCurrency(summary.totalOutstanding)} outstanding`} />
          <StatCard variant="inline" title="Outstanding" value={formatCurrency(summary.totalOutstanding)} />
          <StatCard variant="inline" title="Repaid" value={formatCurrency(summary.totalRepaid)} viz={summary.totalDisbursed > 0 ? { type: 'ring', percent: pct(summary.totalRepaid, summary.totalDisbursed) } : undefined} summary={`Repaid ${formatCurrency(summary.totalRepaid)} of ${formatCurrency(summary.totalDisbursed)} disbursed, ${pct(summary.totalRepaid, summary.totalDisbursed)} percent`} />
          <StatCard variant="inline" title="Active loans" value={summary.activeLoans} />
          <StatCard variant="inline" title="Pending" value={summary.pendingApplications} viz={summary.pendingApplications > 0 ? { type: 'dots', count: summary.pendingApplications } : undefined} summary={`${summary.pendingApplications} loan applications pending`} />
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
            placeholder: 'Search by applicant name',
          }}
        >
          <Segmented
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setCurrentPage(1);
            }}
            options={LOAN_STATUS_TABS.map((tab) => ({ value: tab.value, label: tab.label }))}
          />
        </FilterBar>

        <div className="p-3.5">
        {error && (
          <Alert tone="danger" className="mb-3.5">{error}</Alert>
        )}

        {!loading && rows.length === 0 ? (
          <EmptyState
            title="No loan applications yet"
            description="Start by creating a new application"
            action={{ label: 'New application', onClick: () => navigate('/loans/create') }}
          />
        ) : (
          <Table
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
        </div>
      </Card>
    </div>
  );
}
