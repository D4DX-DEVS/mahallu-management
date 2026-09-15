import { useState, useEffect } from 'react';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import Checkbox from '@/components/ui/Checkbox';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import { toast } from '@/store/toastStore';
import { Pagination as PaginationType, TableColumn } from '@/types';
import {
  zakatDistributionService,
  ZakatDistribution,
  ZakatBeneficiary,
  DISTRIBUTION_TYPE_OPTIONS,
} from '@/services/zakatDistributionService';
import { fetchAllPages } from '@/services/api';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

const emptyForm = {
  beneficiaryId: '',
  amount: '',
  distributionDate: '',
  type: 'regular',
  paymentMethod: 'cash',
  receiptNo: '',
  remarks: '',
  postToLedger: false,
};

const targetName = (row: ZakatDistribution) => {
  const b = row.beneficiaryId;
  if (b && typeof b === 'object') {
    const name = b.memberId?.name || b.name;
    return name ? toTitleCase(name) : '-';
  }
  return '-';
};

export default function DistributionsList() {
  const [rows, setRows] = useState<ZakatDistribution[]>([]);
  const [verified, setVerified] = useState<ZakatBeneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isFormOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [viewing, setViewing] = useState<ZakatDistribution | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<ZakatDistribution | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    fetchRows();
  }, [typeFilter, currentPage]);

  useEffect(() => {
    // Only verified beneficiaries can be paid, so only those are offered.
    // /zakat/beneficiaries caps limit at 100 and 400s above it, so the old
    // limit:200 request always failed and left this picker empty.
    fetchAllPages<ZakatBeneficiary>((p) =>
      zakatDistributionService.getBeneficiaries({ verificationStatus: 'verified', status: 'active', ...p })
    )
      .then((rows) => setVerified(rows))
      .catch((err) => {
        setVerified([]);
        toast.error(loadErrorMessage(err, 'beneficiaries'));
      });
  }, []);

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = { page: currentPage, limit: 10 };
      if (typeFilter) params.type = typeFilter;
      const result = await zakatDistributionService.getDistributions(params);
      setRows(result.data);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'distributions'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.beneficiaryId || !form.amount) {
      toast.error('Please select a beneficiary and enter an amount.');
      return;
    }
    try {
      setSaving(true);
      const amount = Number(form.amount);
      if (editingId) {
        await zakatDistributionService.updateDistribution(editingId, {
          ...form,
          amount,
          distributionDate: form.distributionDate || undefined,
        });
        toast.success('Distribution updated');
      } else {
        await zakatDistributionService.createDistribution({
          ...form,
          amount,
          distributionDate: form.distributionDate || undefined,
        });
        toast.success('Distribution recorded');
      }
      setFormOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      fetchRows();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'save distribution' }));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (row: ZakatDistribution) => {
    const beneficiaryId = typeof row.beneficiaryId === 'object' ? row.beneficiaryId._id : row.beneficiaryId;
    setEditingId(row.id);
    setForm({
      beneficiaryId: beneficiaryId || '',
      amount: String(row.amount ?? ''),
      distributionDate: row.distributionDate ? row.distributionDate.slice(0, 10) : '',
      type: row.type || 'regular',
      paymentMethod: row.paymentMethod || 'cash',
      receiptNo: row.receiptNo || '',
      remarks: row.remarks || '',
      postToLedger: false,
    });
    setFormOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;
    try {
      setDeleteLoading(true);
      await zakatDistributionService.removeDistribution(deleteConfirm.id);
      toast.success('Distribution deleted');
      setDeleteConfirm(null);
      fetchRows();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete distribution' }));
    } finally {
      setDeleteLoading(false);
    }
  };

  const columns: TableColumn<ZakatDistribution>[] = [
    {
      key: 'distributionDate',
      label: 'Date',
      width: '6.25rem',
      render: (v) => (v ? new Date(v).toLocaleDateString() : '-'),
    },
    { key: 'beneficiaryId', label: 'Beneficiary', width: '9.25rem', render: (_v, row) => targetName(row) },
    { key: 'amount', label: 'Amount', width: '7.75rem', render: (v) => `Rs ${v ?? 0}` },
    {
      key: 'type',
      label: 'Type',
      width: '6.25rem',
      render: (v) => DISTRIBUTION_TYPE_OPTIONS.find((o) => o.value === v)?.label || v,
    },
    { key: 'receiptNo', label: 'Receipt', width: '7.5rem', render: (v) => v || '-' },
  ];

  return (
    <div className="space-y-3">
      <PageHeader
        title="Zakat Distributions"
        description="Payments made to verified beneficiaries"
        breadcrumbs={[{ label: 'Zakat' }]}
      />

      <TableCard>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:w-48">
            <Select
              options={[{ value: '', label: 'All types' }, ...DISTRIBUTION_TYPE_OPTIONS]}
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <Button
            size="md"
            onClick={() => {
              setEditingId(null);
              setForm(emptyForm);
              setFormOpen(true);
            }}
            className="w-full sm:w-auto"
          >
            + Record Distribution
          </Button>
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
            title="No distributions yet"
            description="Record a distribution to a verified beneficiary"
            action={{ label: '+ Record Distribution', onClick: () => setFormOpen(true) }}
          />
        ) : (
          <Table
            fixedLayout
            striped
            columns={columns}
            data={rows}
            showExport={false}
            onRowClick={(row) => setViewing(row)}
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

      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          setFormOpen(false);
          setEditingId(null);
        }}
        title={editingId ? 'Edit Zakat Distribution' : 'Record Zakat Distribution'}
      >
        {verified.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            No verified beneficiaries yet. Verify a beneficiary before recording a distribution.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <Select
                label="Beneficiary"
                value={form.beneficiaryId}
                onChange={(e) => setForm({ ...form, beneficiaryId: e.target.value })}
                options={[
                  { value: '', label: 'Select a verified beneficiary' },
                  ...verified.map((b) => ({
                    value: b.id,
                    label: toTitleCase(
                      (b.memberId && typeof b.memberId === 'object' ? b.memberId.name : b.name) || ''
                    ) || 'Unnamed',
                  })),
                ]}
                required
              />
            </div>
            <Input
              label="Amount"
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
            <Input
              label="Date"
              type="date"
              value={form.distributionDate}
              onChange={(e) => setForm({ ...form, distributionDate: e.target.value })}
            />
            <Select
              label="Type"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              options={DISTRIBUTION_TYPE_OPTIONS}
            />
            <Input
              label="Receipt No."
              value={form.receiptNo}
              onChange={(e) => setForm({ ...form, receiptNo: e.target.value })}
            />
            <div className="md:col-span-2">
              <Input
                label="Remarks"
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              />
            </div>
            <label className="flex items-center gap-2 md:col-span-2">
              <Checkbox
                checked={form.postToLedger}
                onChange={(e) => setForm({ ...form, postToLedger: e.target.checked })}
              />
              <span className="text-sm text-gray-700 dark:text-gray-200">
                Post an expense entry to the ledger
              </span>
            </label>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => {
              setFormOpen(false);
              setEditingId(null);
            }}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || verified.length === 0}>
            {saving ? 'Saving...' : editingId ? 'Save' : 'Record'}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(viewing)}
        onClose={() => setViewing(null)}
        title="Distribution Details"
        footer={
          <>
            <Button variant="outline" onClick={() => setViewing(null)}>
              Close
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (viewing) openEdit(viewing);
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
              <span className="text-sm text-gray-500 dark:text-gray-400">Beneficiary</span>
              <p className="text-gray-900 dark:text-gray-100">{targetName(viewing)}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Amount</span>
              <p className="text-gray-900 dark:text-gray-100">Rs {viewing.amount ?? 0}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Date</span>
              <p className="text-gray-900 dark:text-gray-100">
                {viewing.distributionDate ? new Date(viewing.distributionDate).toLocaleDateString() : '-'}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Type</span>
              <p className="text-gray-900 dark:text-gray-100">
                {DISTRIBUTION_TYPE_OPTIONS.find((o) => o.value === viewing.type)?.label || viewing.type}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Payment Method</span>
              <p className="text-gray-900 dark:text-gray-100">
                {viewing.paymentMethod ? toTitleCase(viewing.paymentMethod) : '-'}
              </p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Receipt No.</span>
              <p className="text-gray-900 dark:text-gray-100">{viewing.receiptNo || '-'}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Remarks</span>
              <p className="text-gray-900 dark:text-gray-100">{viewing.remarks || '-'}</p>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title="Delete distribution?"
        message="This permanently removes the distribution record and cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
