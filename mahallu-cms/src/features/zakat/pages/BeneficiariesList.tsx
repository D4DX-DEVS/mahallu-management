import { useState, useEffect } from 'react';
import ActionsMenu from '@/components/ui/ActionsMenu';
import { FiCheck, FiPlus, FiX } from 'react-icons/fi';
import { Link, useNavigate } from 'react-router-dom';
import { FiSend } from 'react-icons/fi';
import Modal from '@/components/ui/Modal';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Tabs from '@/components/ui/Tabs';
import StatusBadge from '@/components/ui/StatusBadge';
import TableToolbar from '@/components/ui/TableToolbar';
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
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectConfirm, setRejectConfirm] = useState<ZakatBeneficiary | null>(null);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [verifyConfirm, setVerifyConfirm] = useState<ZakatBeneficiary | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [viewing, setViewing] = useState<ZakatBeneficiary | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ZakatBeneficiary | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  // A page number that only made sense for the previous search must not
  // survive into the new one - reset it once the debounce settles.
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchRows();
  }, [statusFilter, debouncedSearch, currentPage, itemsPerPage]);

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = { page: currentPage, limit: itemsPerPage };
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

  const handleVerifyConfirm = async () => {
    if (!verifyConfirm) return;
    try {
      setVerifyLoading(true);
      await setVerification(verifyConfirm, 'verified');
      setVerifyConfirm(null);
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    try {
      setDeleteLoading(true);
      await zakatDistributionService.removeBeneficiary(deleteConfirm.id);
      toast.success('Beneficiary deleted');
      setDeleteConfirm(null);
      fetchRows();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete beneficiary' }));
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns: TableColumn<ZakatBeneficiary>[] = [
    {
      key: 'name',
      label: 'Beneficiary',
      width: '16rem',
      sortable: false,
      render: (_v, row) => <span className="font-medium text-foreground">{beneficiaryName(row)}</span>,
    },
    {
      key: 'category',
      label: 'Category',
      sortable: true,
      width: '12rem',
      render: (v) => ZAKAT_CATEGORY_OPTIONS.find((o) => o.value === v)?.label || v,
    },
    { key: 'priorityArea', label: 'Priority', sortable: true, priority: 'secondary', width: '10rem', render: (v) => v || '—' },
    {
      key: 'verificationStatus',
      label: 'Verification',
      sortable: true,
      width: '9rem',
      render: (v) => <StatusBadge status={v} />,
    },
    {
      key: 'actions',
      label: '',
      width: '6.5rem',
      align: 'right',
      sortable: false,
      render: (_v, row) => (
        <ActionsMenu
          label={`Actions for ${beneficiaryName(row)}`}
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
                    onClick: () => setVerifyConfirm(row),
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

  const isFiltered = Boolean(statusFilter || debouncedSearch);

  return (
    <>
      <PageHeader
        title="Zakat beneficiaries"
        description="Only verified beneficiaries can receive distributions."
        actions={
          <Link to="/zakat/beneficiaries/create">
            <Button icon={<FiPlus />} collapseLabel>
              New beneficiary
            </Button>
          </Link>
        }
      />

      <TableCard>
        <TableToolbar
          tabs={
            <Tabs
              variant="segmented"
              ariaLabel="Verification status"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}
              items={STATUS_TABS}
            />
          }
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchEntity="beneficiaries"
          onRefresh={fetchRows}
        />

        {error ? (
          <EmptyState variant="error" entity="beneficiaries" description={error} action={{ label: 'Try again', onClick: fetchRows }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={rows}
              isLoading={loading}
              entity="beneficiaries"
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
                  : { label: 'Add beneficiary', onClick: () => navigate('/zakat/beneficiaries/create') }
              }
              onRowClick={(row) => setViewing(row)}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="beneficiaries"
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

      <ConfirmDialog
        isOpen={!!verifyConfirm}
        title="Verify this beneficiary?"
        message={`Verify ${verifyConfirm ? beneficiaryName(verifyConfirm) : 'this beneficiary'}? They will become eligible for distributions.`}
        confirmLabel="Verify beneficiary"
        variant="primary"
        isLoading={verifyLoading}
        onConfirm={handleVerifyConfirm}
        onCancel={() => setVerifyConfirm(null)}
      />

      <Modal
        isOpen={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title="Beneficiary Details"
        footer={
          <>
            <Button variant="outline" onClick={() => setViewing(null)}>
              Close
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (viewing) navigate(`/zakat/beneficiaries/${viewing.id}`);
                setViewing(null);
              }}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (viewing) setDeleteConfirm(viewing);
                setViewing(null);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        {viewing && (
          <div className="space-y-3">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Name</span>
              <p className="text-gray-900 dark:text-gray-100">{beneficiaryName(viewing)}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Category</span>
              <p className="text-gray-900 dark:text-gray-100">
                {ZAKAT_CATEGORY_OPTIONS.find((o) => o.value === viewing.category)?.label || viewing.category}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Priority Area</span>
              <p className="text-gray-900 dark:text-gray-100">{viewing.priorityArea || '-'}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Verification</span>
              <p className="text-gray-900 dark:text-gray-100">{viewing.verificationStatus}</p>
            </div>
            {viewing.notes && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Notes</span>
                <p className="text-gray-900 dark:text-gray-100">{viewing.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="Delete beneficiary?"
        message={`Delete ${deleteConfirm ? beneficiaryName(deleteConfirm) : 'this beneficiary'}? This permanently removes their record.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
      />
    </>
  );
}
