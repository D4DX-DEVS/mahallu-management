import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiSend } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import SearchInput from '@/components/ui/SearchInput';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
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
      setError(err.response?.data?.message || 'Failed to load beneficiaries');
    } finally {
      setLoading(false);
    }
  };

  const setVerification = async (row: ZakatBeneficiary, verificationStatus: VerificationStatus) => {
    try {
      setBusyId(row._id);
      await zakatDistributionService.verifyBeneficiary(row._id, { verificationStatus });
      if (verificationStatus === 'verified') {
        toast.success('Beneficiary verified');
      } else if (verificationStatus === 'rejected') {
        toast.success('Beneficiary rejected');
      }
      fetchRows();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update verification');
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
    { key: 'name', label: 'Beneficiary', render: (_v, row) => beneficiaryName(row) },
    {
      key: 'category',
      label: 'Category',
      render: (v) => ZAKAT_CATEGORY_OPTIONS.find((o) => o.value === v)?.label || v,
    },
    { key: 'priorityArea', label: 'Priority', render: (v) => v || '-' },
    { key: 'verificationStatus', label: 'Verification' },
    {
      key: 'actions',
      label: '',
      render: (_v, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {row.verificationStatus === 'verified' && (
            <button
              className="text-blue-600 hover:text-blue-800 disabled:opacity-50"
              disabled={busyId === row._id}
              onClick={() => navigate('/zakat/distributions/create', { state: { beneficiaryId: row._id } })}
              title="Record a distribution for this beneficiary"
            >
              <FiSend size={16} />
            </button>
          )}
          {row.verificationStatus !== 'verified' && (
            <button
              className="text-emerald-600 hover:underline disabled:opacity-50"
              disabled={busyId === row._id}
              onClick={() => setVerification(row, 'verified')}
            >
              {busyId === row._id ? 'Working...' : 'Verify'}
            </button>
          )}
          {row.verificationStatus === 'pending' && (
            <button
              className="text-red-600 hover:underline disabled:opacity-50"
              disabled={busyId === row._id}
              onClick={() => setRejectConfirm(row)}
            >
              {busyId === row._id ? 'Working...' : 'Reject'}
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Zakat Beneficiaries</h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Only verified beneficiaries can receive distributions
          </p>
        </div>
        <Breadcrumb
          items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Zakat' }, { label: 'Beneficiaries' }]}
        />
      </div>

      <Card>
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
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="w-full sm:w-56">
              <SearchInput
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by name..."
              />
            </div>
            <Link to="/zakat/beneficiaries/create">
              <Button size="md" className="w-full sm:w-auto">
                + New Beneficiary
              </Button>
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="py-12 text-center">
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
          <div className="overflow-x-auto">
            <Table columns={columns} data={rows} showExport={false} />
          </div>
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
      </Card>

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
