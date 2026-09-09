import { useState, useEffect } from 'react';
import { FiList, FiPlus } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import { PageSkeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { Pagination as PaginationType, TableColumn } from '@/types';
import { welfareService, WelfareApplication, WelfareSummary, WelfareScheme } from '@/services/welfareService';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

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
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationType | null>(null);

  useEffect(() => {
    fetchRows();
  }, [statusFilter, schemeFilter, currentPage]);

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
      const params: Record<string, any> = { page: currentPage, limit: 10 };
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
    { key: 'schemeId', label: 'Scheme', width: '7.75rem', render: (v) => nameOf(v, 'name') },
    { key: 'familyId', label: 'Family', width: '7.25rem', render: (v) => nameOf(v, 'houseName') },
    { key: 'requestedAmount', label: 'Requested', width: '8.75rem', render: (v) => `Rs ${v ?? 0}` },
    { key: 'approvedAmount', label: 'Approved', width: '8.25rem', render: (v) => (v ? `Rs ${v}` : '-') },
    { key: 'priority', label: 'Priority', width: '7.75rem' },
    { key: 'status', label: 'Status', width: '7.25rem' },
  ];

  const summaryCards = [
    { label: 'Total', value: summary?.total ?? 0 },
    { label: 'Pending', value: summary?.pending ?? 0 },
    { label: 'Approved', value: summary?.approved ?? 0 },
    { label: 'Disbursed', value: `Rs ${summary?.disbursedAmount ?? 0}` },
  ];

  return (
    <div className="space-y-3">
      <PageHeader title="Welfare Applications" description="Assistance requests and their approval trail" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {summaryCards.map((card) => (
          <Card key={card.label}>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 sm:text-sm">{card.label}</p>
            <p className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100 sm:text-xl">
              {card.value}
            </p>
          </Card>
        ))}
      </div>

      <TableCard>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-3 gap-1.5 sm:flex sm:flex-wrap sm:items-center">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value || 'all'}
                onClick={() => {
                  setStatusFilter(tab.value);
                  setCurrentPage(1);
                }}
                className={[
                  'rounded-lg border px-2 py-1.5 text-xs font-medium',
                  statusFilter === tab.value
                    ? 'border-primary-300 bg-primary-50 text-primary-900'
                    : 'border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
                ].join(' ')}
              >
                {tab.label}
              </button>
            ))}
            <Select
              options={[
                { value: '', label: 'All schemes' },
                ...schemes.map((s) => ({ value: s.id, label: s.name })),
              ]}
              value={schemeFilter}
              onChange={(e) => {
                setSchemeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="text-xs"
            />
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <Link to="/welfare/schemes">
              <Button variant="outline" size="md" icon={<FiList />} collapseLabel>
                Schemes
              </Button>
            </Link>
            <Link to="/welfare/applications/create">
              <Button size="md" icon={<FiPlus />} collapseLabel>
                New Application
              </Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="py-10 text-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchRows} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No applications found"
            description="Create a welfare application to get started"
            action={{
              label: 'Create Application',
              onClick: () => navigate('/welfare/applications/create'),
            }}
          />
        ) : (
          <Table
            fixedLayout
            striped
            columns={columns}
            data={rows}
            emptyMessage="No applications found"
            showExport={false}
            onRowClick={(row) => navigate(`/welfare/applications/${row.id}`)}
          />
        )}

        {pagination && (
          <div className="mt-4">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </TableCard>
    </div>
  );
}
