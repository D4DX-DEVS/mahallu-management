import { useState, useEffect, useCallback } from 'react';
import { PersonCell } from '@/components/ui/Avatar';
import RowActions from '@/components/ui/RowActions';
import { FiCheck, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import StatusBadge from '@/components/ui/StatusBadge';
import Alert from '@/components/ui/Alert';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { useAuthStore } from '@/store/authStore';
import { Pagination as PaginationType, TableColumn } from '@/types';
import { formatINR } from '@/utils/formatINR';
import {
  zakatDistributionService,
  ZakatDistribution,
  ZakatBeneficiary,
  ZakatFund,
  ASNAF_OPTIONS,
  DISTRIBUTION_TYPE_OPTIONS,
} from '@/services/zakatDistributionService';
import ZakatFundMeter from '../components/ZakatFundMeter';
import DistributionFields, {
  DistributionForm,
  emptyDistributionForm,
} from '../components/DistributionFields';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'proposed', label: 'Waiting for approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Waiting for approval',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

const rowId = (row: ZakatDistribution) => row.id;
const effectiveStatus = (row: ZakatDistribution) => row.status ?? 'approved';

const targetName = (row: ZakatDistribution) => {
  const b = row.beneficiaryId;
  if (b && typeof b === 'object') return b.memberId?.name || b.name || '-';
  return '-';
};

const targetPhoto = (row: ZakatDistribution): string | undefined => {
  const m = typeof row.beneficiaryId === 'object' && row.beneficiaryId ? (row.beneficiaryId as { memberId?: unknown }).memberId : undefined;
  return m && typeof m === 'object' ? (m as { photoUrl?: string }).photoUrl : undefined;
};

type ReasonAction = { kind: 'reject' | 'cancel'; row: ZakatDistribution } | null;

export default function DistributionsList() {
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [rows, setRows] = useState<ZakatDistribution[]>([]);
  const [verified, setVerified] = useState<ZakatBeneficiary[]>([]);
  const [fund, setFund] = useState<ZakatFund | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<DistributionForm>(emptyDistributionForm());
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasonAction, setReasonAction] = useState<ReasonAction>(null);
  const [reason, setReason] = useState('');

  const loadFund = useCallback(() => {
    zakatDistributionService.getFund().then(setFund).catch(() => setFund(null));
  }, []);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = { page: currentPage, limit: 10 };
      if (typeFilter) params.type = typeFilter;
      if (statusFilter) params.status = statusFilter;
      const result = await zakatDistributionService.getDistributions(params);
      setRows(result.data);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(getFriendlyError(err, "We couldn't load the distributions. Please try again."));
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter, currentPage]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    loadFund();
    // Only verified beneficiaries can be paid, so only those are offered
    zakatDistributionService
      .getBeneficiaries({ verificationStatus: 'verified', status: 'active', limit: 200 })
      .then((result) => setVerified(result.data))
      .catch(() => setVerified([]));
  }, [loadFund]);

  const refreshAll = () => {
    fetchRows();
    loadFund();
  };

  const openForm = () => {
    setForm(emptyDistributionForm());
    setFormErrors({});
    setFormOpen(true);
  };

  const handleSave = async () => {
    const errs: Record<string, string> = {};
    if (!form.beneficiaryId) errs.beneficiaryId = 'Select a beneficiary';
    if (!form.asnafCategory) errs.asnafCategory = 'Choose the asnaf category';
    if (!form.amount || Number(form.amount) <= 0) errs.amount = 'Enter an amount greater than zero';
    setFormErrors(errs);
    if (Object.keys(errs).length) return;

    try {
      setSaving(true);
      const payload: Record<string, any> = { ...form, amount: Number(form.amount) };
      if (!payload.receiptNo) delete payload.receiptNo;
      const result = await zakatDistributionService.createDistribution(payload);
      toast.success(
        result.status === 'proposed'
          ? 'Distribution proposed. It needs approval before it is paid out.'
          : 'Distribution recorded'
      );
      setFormOpen(false);
      refreshAll();
    } catch (err: any) {
      toast.error(getFriendlyError(err, "We couldn't record this distribution. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const approve = async (row: ZakatDistribution) => {
    try {
      setBusyId(rowId(row));
      const res = await zakatDistributionService.approveDistribution(rowId(row));
      toast.success(res.message || 'Distribution approved');
      refreshAll();
    } catch (err: any) {
      toast.error(getFriendlyError(err, "We couldn't approve this distribution. Try again in a moment."));
    } finally {
      setBusyId(null);
    }
  };

  const submitReason = async () => {
    if (!reasonAction) return;
    if (reason.trim().length < 3) {
      toast.error('Add a short reason to continue');
      return;
    }
    const { kind, row } = reasonAction;
    try {
      setBusyId(rowId(row));
      const res =
        kind === 'reject'
          ? await zakatDistributionService.rejectDistribution(rowId(row), reason.trim())
          : await zakatDistributionService.cancelDistribution(rowId(row), reason.trim());
      toast.success(res.message || (kind === 'reject' ? 'Distribution rejected' : 'Distribution cancelled'));
      setReasonAction(null);
      setReason('');
      refreshAll();
    } catch (err: any) {
      toast.error(getFriendlyError(err, 'That did not go through. Please try again.'));
    } finally {
      setBusyId(null);
    }
  };

  // A different admin must approve when the mahallu has more than one
  const mustUseAnotherAdmin = (row: ZakatDistribution) =>
    !!fund &&
    fund.adminCount > 1 &&
    fund.settings.requireDifferentApprover &&
    !!row.createdBy &&
    row.createdBy === currentUserId;

  const columns: TableColumn<ZakatDistribution>[] = [
    {
      key: 'distributionDate',
      label: 'Date',
      render: (v) => (v ? new Date(v).toLocaleDateString('en-GB') : '-'),
    },
    { key: 'beneficiaryId', label: 'Beneficiary', render: (_v, row) => <PersonCell name={targetName(row) === '-' ? '' : targetName(row)} src={targetPhoto(row)} /> },
    {
      key: 'asnafCategory',
      label: 'Asnaf',
      render: (v) => { const l = ASNAF_OPTIONS.find((o) => o.value === v)?.label.split(' (')[0]; return l ? <StatusBadge status={v} label={l} tone="neutral" dot={false} /> : '-'; },
    },
    { key: 'amount', label: 'Amount', align: 'right', render: (v) => formatINR(v) },
    {
      key: 'type',
      label: 'Type',
      render: (v) => <StatusBadge status={v} label={DISTRIBUTION_TYPE_OPTIONS.find((o) => o.value === v)?.label || String(v ?? '')} tone="neutral" dot={false} />,
    },
    { key: 'voucherNo', label: 'Voucher', render: (v, row) => v || row.receiptNo || '-' },
    {
      key: 'status',
      label: 'Status',
      render: (_v, row) => {
        const s = effectiveStatus(row);
        const note = s === 'rejected' ? row.rejectionReason : s === 'cancelled' ? row.cancelReason : undefined;
        return (
          <span title={note}>
            <StatusBadge status={s === 'proposed' ? 'pending' : s} label={STATUS_LABEL[s]} />
          </span>
        );
      },
    },
    {
      key: 'actions',
      label: '',
      hideable: false,
      render: (_v, row) => {
        const s = effectiveStatus(row);
        const busy = busyId === rowId(row);
        if (s === 'proposed') {
          const blocked = mustUseAnotherAdmin(row);
          return (
            <RowActions
              extra={[
                {
                  label: 'Approve',
                  icon: <FiCheck />,
                  onClick: () => approve(row),
                  disabledReason: busy ? 'Working...' : blocked ? 'You proposed this, so another admin needs to approve it.' : undefined,
                },
              ]}
              onDelete={() => {
                setReason('');
                setReasonAction({ kind: 'reject', row });
              }}
              deleteLabel="Reject"
              deleteIcon={<FiX />}
              disabledReason={{ delete: busy ? 'Working...' : undefined }}
            />
          );
        }
        if (s === 'approved') {
          return (
            <RowActions
              onDelete={() => {
                setReason('');
                setReasonAction({ kind: 'cancel', row });
              }}
              deleteLabel="Cancel distribution"
              disabledReason={{ delete: busy ? 'Working...' : undefined }}
            />
          );
        }
      },
    },
  ];

  const waiting = fund?.proposed ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Zakat Distributions"
        description="Payments to verified beneficiaries, checked against the zakat fund"
        actions={<Button onClick={openForm}>+ Record Distribution</Button>}
      />

      <ZakatFundMeter fund={fund} />

      {waiting > 0 && (
        <Alert tone="warning">
          {formatINR(waiting)} in proposed distributions is waiting for approval. Approve or reject each one so the fund
          stays accurate.
        </Alert>
      )}

      <Card padding="none" className="overflow-visible">
        <FilterBar>
          <div className="w-full sm:w-48">
            <Select
              aria-label="Filter by type"
              options={[{ value: '', label: 'All types' }, ...DISTRIBUTION_TYPE_OPTIONS]}
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="w-full sm:w-52">
            <Select
              aria-label="Filter by status"
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
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
              title="No distributions yet"
              description="Record a distribution to a verified beneficiary"
              action={{ label: '+ Record Distribution', onClick: openForm }}
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

      <Modal isOpen={isFormOpen} onClose={() => setFormOpen(false)} title="Record Zakat Distribution" size="lg">
        {verified.length === 0 ? (
          <p className="text-sm text-[#5B6963] dark:text-surface-muted">
            No verified beneficiaries yet. Verify a beneficiary before recording a distribution.
          </p>
        ) : (
          <DistributionFields form={form} setForm={setForm} verified={verified} fund={fund} errors={formErrors} />
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setFormOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || verified.length === 0}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={!!reasonAction}
        onClose={() => setReasonAction(null)}
        title={reasonAction?.kind === 'reject' ? 'Reject this distribution' : 'Cancel this distribution'}
        size="sm"
      >
        {reasonAction && (
          <>
            <p className="text-[13px] text-[#3A4741] dark:text-surface-text">
              {reasonAction.kind === 'reject'
                ? `${formatINR(reasonAction.row.amount)} to ${targetName(reasonAction.row)} will not be paid. The proposer will see your reason.`
                : `${formatINR(reasonAction.row.amount)} to ${targetName(reasonAction.row)} will be cancelled. The ledger entry is reversed and the amount goes back to the zakat fund. The record stays for audit.`}
            </p>
            <div className="mt-3">
              <Input
                label="Reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={reasonAction.kind === 'reject' ? 'For example: not yet verified at home visit' : 'For example: paid twice by mistake'}
                required
              />
            </div>
            <div className="mt-5 flex justify-end gap-2.5">
              <Button variant="secondary" onClick={() => setReasonAction(null)} disabled={!!busyId}>
                Keep it
              </Button>
              <Button variant="danger-solid" onClick={submitReason} disabled={!!busyId}>
                {busyId ? 'Working...' : reasonAction.kind === 'reject' ? 'Reject' : 'Cancel distribution'}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
