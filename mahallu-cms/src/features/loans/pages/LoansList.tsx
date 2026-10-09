import { useState, useEffect } from 'react';
import { FiPlus } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import StatCard from '@/components/ui/StatCard';
import Tabs from '@/components/ui/Tabs';
import TableToolbar from '@/components/ui/TableToolbar';
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
import { toTitleCase } from '@/utils/format';
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
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchRows();
  }, [statusFilter, debouncedSearch, currentPage, itemsPerPage]);

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
      const params: Record<string, any> = { page: currentPage, limit: itemsPerPage };
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
    {
      key: 'applicantName',
      label: 'Applicant',
      sortable: false,
      width: '16rem',
      render: (_v, row) => <span className="font-medium text-foreground">{toTitleCase(loanApplicantName(row))}</span>,
    },
    {
      key: 'purpose',
      label: 'Purpose',
      sortable: true,
      priority: 'secondary',
      width: '11rem',
      render: (v) => LOAN_PURPOSE_OPTIONS.find((o) => o.value === v)?.label || v,
    },
    {
      key: 'amount',
      label: 'Amount',
      width: '9rem',
      align: 'right',
      sortable: true,
      render: (v, row) => formatCurrency(row.approvedAmount ?? v),
    },
    {
      key: 'outstandingBalance',
      label: 'Outstanding',
      width: '9rem',
      align: 'right',
      sortable: true,
      priority: 'secondary',
      render: (v) => (v > 0 ? formatCurrency(v) : '—'),
    },
    { key: 'appliedDate', label: 'Applied', sortable: true, priority: 'secondary', width: '9rem', render: (v) => formatDate(v) },
    { key: 'status', label: 'Status', sortable: true, width: '8rem', render: (v) => <LoanStatusBadge status={v} /> },
  ];

  const isFiltered = Boolean(statusFilter || debouncedSearch);

  return (
    <>
      <PageHeader
        title="Qard Hasan"
        description="Interest-free loans, from application through repayment."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => navigate('/loans/create')}>
            New application
          </Button>
        }
      />

      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          <StatCard title="Disbursed" value={formatCurrency(summary.totalDisbursed)} />
          <StatCard title="Outstanding" value={formatCurrency(summary.totalOutstanding)} />
          <StatCard title="Repaid" value={formatCurrency(summary.totalRepaid)} />
          <StatCard title="Active loans" value={summary.activeLoans} />
          <StatCard title="Pending" value={summary.pendingApplications} />
        </div>
      )}

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
              items={LOAN_STATUS_TABS}
            />
          }
          searchQuery={searchQuery}
          onSearchChange={(value) => {
            setSearchQuery(value);
            setCurrentPage(1);
          }}
          searchEntity="loan applications"
          onRefresh={fetchRows}
        />

        {error ? (
          <EmptyState variant="error" entity="loans" description={error} action={{ label: 'Try again', onClick: fetchRows }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={rows}
              isLoading={loading}
              entity="loan applications"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? {
                      label: 'Clear filters',
                      onClick: () => {
                        setSearchQuery('');
                        setStatusFilter('');
                        setCurrentPage(1);
                      },
                    }
                  : { label: 'New application', onClick: () => navigate('/loans/create') }
              }
              onRowClick={(row) => navigate(`/loans/${row.id}`)}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="loan applications"
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
