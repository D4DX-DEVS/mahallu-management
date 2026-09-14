import { useState, useEffect } from 'react';
import ActionsMenu from '@/components/ui/ActionsMenu';
import { FiCheck, FiPlus, FiX } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import { FiSend } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import ExpandableSearch from '@/components/ui/ExpandableSearch';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { Pagination as PaginationType, TableColumn } from '@/types';
import {
  zakatDistributionService,
  ZakatBeneficiary,
  ZAKAT_CATEGORY_OPTIONS,
  VerificationStatus,
} from '@/services/zakatDistributionService';
import { useDebounce } from '@/hooks/useDebounce';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

const STATUS_TABS: Array<{ value: string; label: string }> = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'verified', label: 'Verified' },
  { value: 'rejected', label: 'Rejected' },
];

const beneficiaryName = (row: ZakatBeneficiary) => {
  if (row.memberId && typeof row.memberId === 'object') return toTitleCase(row.memberId.name);
  return row.name ? toTitleCase(row.name) : '-';
};

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

  // A page number that only made sense for the previous search must not
  // survive into the new one - reset it once the debounce settles.
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

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
      setError(loadErrorMessage(err, 'beneficiaries'));
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
      toast.error(errorMessage(err, { action: 'update verification' }));
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
    { key: 'name', label: 'Beneficiary', width: '9.25rem', render: (_v, row) => beneficiaryName(row) },
    {
      key: 'category',
      label: 'Category',
      width: '8.25rem',
      render: (v) => ZAKAT_CATEGORY_OPTIONS.find((o) => o.value === v)?.label || v,
    },
    { key: 'priorityArea', label: 'Priority', width: '7.75rem', render: (v) => v || '-' },
    { key: 'verificationStatus', label: 'Verification', width: '9.5rem' },
    {
      key: 'actions',
      label: 'Actions',
      width: '8rem',
      align: 'center',
      render: (_v, row) => (
        <ActionsMenu
          items={[
            ...(row.verificationStatus === 'verified'
              ? [
                  {
                    label: 'Record a distribution',
                    icon: <FiSend className="h-4 w-4" />,
                    onClick: () =>
                      navigate('/zakat/distributions/create', { state: { beneficiaryId: row.id } }),
                    disabled: busyId === row.id,
                  },
                ]
              : [
                  {
                    label: 'Verify',
                    icon: <FiCheck className="h-4 w-4" />,
                    onClick: () => setVerification(row, 'verified'),
                    disabled: busyId === row.id,
                  },
                ]),
            ...(row.verificationStatus === 'pending'
              ? [
                  {
                    label: 'Reject',
                    icon: <FiX className="h-4 w-4" />,
                    onClick: () => setRejectConfirm(row),
                    disabled: busyId === row.id,
                    variant: 'danger' as const,
                  },
                ]
              : []),
          ]}
        />
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <PageHeader
        title="Zakat Beneficiaries"
        description="Only verified beneficiaries can receive distributions"
        breadcrumbs={[{ label: 'Zakat' }]}
      />

      <TableCard>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="grid grid-cols-4 gap-1.5 sm:flex">
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
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0 flex-1 sm:w-56 sm:flex-none">
              <ExpandableSearch
                value={searchQuery}
                onChange={setSearchQuery}
                entity="beneficiaries"
                placeholder="Search by name"
              />
            </div>
            <Link to="/zakat/beneficiaries/create">
              <Button size="md" icon={<FiPlus />} collapseLabel>
                New Beneficiary
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
            title="No beneficiaries yet"
            description="Start by registering a beneficiary"
            action={{ label: '+ New Beneficiary', onClick: () => navigate('/zakat/beneficiaries/create') }}
          />
        ) : (
          <Table fixedLayout striped columns={columns} data={rows} showExport={false} />
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

      <ConfirmDialog
        isOpen={!!rejectConfirm}
        title="Reject beneficiary?"
        message={`Reject ${rejectConfirm ? beneficiaryName(rejectConfirm) : 'this beneficiary'}? They will not be able to receive distributions.`}
        consequence="This action cannot be undone."
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
