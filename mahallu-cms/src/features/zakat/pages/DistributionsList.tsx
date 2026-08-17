import { useState, useEffect } from 'react';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import Checkbox from '@/components/ui/Checkbox';
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
  if (b && typeof b === 'object') return b.memberId?.name || b.name || '-';
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
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRows();
  }, [typeFilter, currentPage]);

  useEffect(() => {
    // Only verified beneficiaries can be paid, so only those are offered
    zakatDistributionService
      .getBeneficiaries({ verificationStatus: 'verified', status: 'active', limit: 200 })
      .then((result) => setVerified(result.data))
      .catch(() => setVerified([]));
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
      setError(err.response?.data?.message || 'Failed to load distributions');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!form.beneficiaryId || !form.amount) {
      toast.error('Beneficiary and amount are required');
      return;
    }
    try {
      setSaving(true);
      const amount = Number(form.amount);
      await zakatDistributionService.createDistribution({
        ...form,
        amount,
        distributionDate: form.distributionDate || undefined,
      });
      toast.success(`Distribution recorded`);
      setFormOpen(false);
      setForm(emptyForm);
      fetchRows();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to record distribution');
    } finally {
      setSaving(false);
    }
  };

  const columns: TableColumn<ZakatDistribution>[] = [
    {
      key: 'distributionDate',
      label: 'Date',
      render: (v) => (v ? new Date(v).toLocaleDateString() : '-'),
    },
    { key: 'beneficiaryId', label: 'Beneficiary', render: (_v, row) => targetName(row) },
    { key: 'amount', label: 'Amount', render: (v) => `Rs ${v ?? 0}` },
    {
      key: 'type',
      label: 'Type',
      render: (v) => DISTRIBUTION_TYPE_OPTIONS.find((o) => o.value === v)?.label || v,
    },
    { key: 'receiptNo', label: 'Receipt', render: (v) => v || '-' },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Zakat Distributions</h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Payments made to verified beneficiaries
          </p>
        </div>
        <Breadcrumb
          items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Zakat' }, { label: 'Distributions' }]}
        />
      </div>

      <Card>
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
          <Button size="md" onClick={() => setFormOpen(true)} className="w-full sm:w-auto">
            + Record Distribution
          </Button>
        </div>

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="py-12 text-center">
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

      <Modal isOpen={isFormOpen} onClose={() => setFormOpen(false)} title="Record Zakat Distribution">
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
                    value: b._id,
                    label:
                      (b.memberId && typeof b.memberId === 'object' ? b.memberId.name : b.name) || 'Unnamed',
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
          <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || verified.length === 0}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
