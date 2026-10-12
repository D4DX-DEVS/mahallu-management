import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiSend, FiCheck, FiX } from 'react-icons/fi';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import FilterBar from '@/components/ui/FilterBar';
import Segmented from '@/components/ui/Segmented';
import StatusBadge from '@/components/ui/StatusBadge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PageHeader from '@/components/ui/PageHeader';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { Pagination as PaginationType, TableColumn } from '@/types';
import {
  zakatDistributionService,
  ZakatBeneficiary,
  ZAKAT_CATEGORY_OPTIONS,
  VerificationStatus,
} from '@/services/zakatDistributionService';
import { useDebounce } from '@/hooks/useDebounce';

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
];

const beneficiaryName = (row: ZakatBeneficiary) => {
  if (row.memberId && typeof row.memberId === 'object') return row.memberId.name;
  return row.name || '-';
};

const memberPhoto = (m: unknown): string | undefined =>
  m && typeof m === 'object' ? (m as { photoUrl?: string }).photoUrl : undefined;

export default function BeneficiariesList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<ZakatBeneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectConfirm, setRejectConfirm] = useState<ZakatBeneficiary | null>(null);
  const [rejectLoading, setRejectLoading] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchRows();
  }, [statusFilter, debouncedSearch, currentPage]);

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = { page: currentPage, limit: 10 };
      if (statusFilter) params.verificationStatus = statusFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const result = await zakatDistributionService.getBeneficiaries(params);
      setRows(result.data);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load beneficiaries. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  const setVerification = async (row: ZakatBeneficiary, verificationStatus: VerificationStatus) => {
    try {
      setBusyId(row.id);
      await zakatDistributionService.verifyBeneficiary(row.id, { verificationStatus });
      if (verificationStatus === 'verified') {
        toast.success('Beneficiary verified');
      } else if (verificationStatus === 'rejected') {
        toast.success('Beneficiary rejected');
      }
      fetchRows();
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't update verification. Try again in a moment."));
    } finally {
      setBusyId(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectConfirm) return;
    try {
      setRejectLoading(true);
      await setVerification(rejectConfirm, 'rejected');
      setRejectConfirm(null);
    } finally {
      setRejectLoading(false);
    }
  };

  const columns: TableColumn<ZakatBeneficiary>[] = [
    { key: 'name', label: 'Beneficiary', render: (_v, row) => <PersonCell name={beneficiaryName(row)} src={memberPhoto(row.memberId)} /> },
    {
      key: 'category',
      label: 'Category',
      render: (v) => <StatusBadge status={v} label={ZAKAT_CATEGORY_OPTIONS.find((o) => o.value === v)?.label || String(v ?? '')} tone="neutral" dot={false} />,
    },
    { key: 'priorityArea', label: 'Priority', render: (v) => (v ? <StatusBadge status={v} tone="neutral" dot={false} /> : '-') },
    {
      key: 'verificationStatus',
      label: 'Verification',
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: 'actions',
      label: '',
      hideable: false,
      render: (_v, row) => (
        <RowActions
          extra={[
            {
              label: 'Record a distribution for this beneficiary',
              icon: <FiSend />,
              onClick: () => navigate('/zakat/distributions/create', { state: { beneficiaryId: row.id } }),
              show: row.verificationStatus === 'verified',
              disabledReason: busyId === row.id ? 'Working...' : undefined,
            },
            {
              label: 'Verify',
              icon: <FiCheck />,
              onClick: () => setVerification(row, 'verified'),
              show: row.verificationStatus !== 'verified',
              disabledReason: busyId === row.id ? 'Working...' : undefined,
            },
          ]}
          onDelete={row.verificationStatus === 'pending' ? () => setRejectConfirm(row) : undefined}
          deleteLabel="Reject"
          deleteIcon={<FiX />}
          disabledReason={{ delete: busyId === row.id ? 'Working...' : undefined }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Zakat Beneficiaries"
        description="Only verified beneficiaries can receive distributions"
        actions={
          <Link to="/zakat/beneficiaries/create">
            <Button>+ New Beneficiary</Button>
          </Link>
        }
      />

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{
            value: searchQuery,
            onChange: (v) => {
              setSearchQuery(v);
              setCurrentPage(1);
            },
            placeholder: 'Search by name...',
          }}
        >
          <Segmented
            aria-label="Filter by verification status"
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setCurrentPage(1);
            }}
            options={STATUS_TABS.map((tab) => ({ value: tab.value, label: tab.label }))}
          />
        </FilterBar>

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
        ) : rows.length === 0 ? (
          <EmptyState
            title="No beneficiaries yet"
            description="Start by registering a beneficiary"
            action={{ label: '+ New Beneficiary', onClick: () => navigate('/zakat/beneficiaries/create') }}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table columns={columns} data={rows} showExport={false} />
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
        isOpen={!!rejectConfirm}
        title="Reject beneficiary?"
        message={`Reject ${rejectConfirm ? beneficiaryName(rejectConfirm) : 'this beneficiary'}? They will not be able to receive distributions.`}
        consequence="This cannot be undone."
        confirmLabel="Reject"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={rejectLoading}
        onConfirm={handleRejectConfirm}
        onCancel={() => setRejectConfirm(null)}
      />
    </div>
  );
}
