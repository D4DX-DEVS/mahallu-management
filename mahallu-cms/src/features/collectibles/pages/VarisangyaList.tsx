import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiCreditCard, FiDollarSign, FiPlus, FiX } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import Modal from '@/components/ui/Modal';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { collectibleService, Varisangya } from '@/services/collectibleService';
import { fetchAllPages } from '@/services/api';
import { buildVarisangyaColumns, getPayerName, getFamilyName } from '../varisangyaColumns';
import { filterByDateRange } from '../varisangyaFilters';
import { formatDate, toTitleCase } from '@/utils/format';
import { exportToCSV, exportToJSON } from '@/utils/exportUtils';
import { exportInvoicesToPdf, downloadInvoicePdf, InvoiceDetails } from '@/utils/invoiceUtils';
import { familyService } from '@/services/familyService';
import { memberService } from '@/services/memberService';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

export default function VarisangyaList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [familyNameFilter, setFamilyNameFilter] = useState('');
  const [varisangyas, setVarisangyas] = useState<Varisangya[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [editingRow, setEditingRow] = useState<Varisangya | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({ amount: 0, paymentDate: '', paymentMethod: '', remarks: '' });

  useEffect(() => {
    fetchVarisangyas();
  }, [currentPage, dateFrom, dateTo, familyNameFilter]);

  const fetchVarisangyas = async () => {
    try {
      setLoading(true);
      setError(null);
      const hasDateFilter = Boolean(dateFrom || dateTo);
      const hasFamilyFilter = familyNameFilter.trim().length > 0;
      const hasClientFilter = hasDateFilter || hasFamilyFilter;
      let data: Varisangya[];
      let total: number;
      let hasPagination: boolean;
      if (hasClientFilter) {
        // Client-side date/name filtering needs every matching row, not one page.
        // The endpoint caps limit at 100 and 400s above it, so the old
        // limit:10000 request always failed - page through instead.
        const filterParams: Record<string, unknown> = { _t: Date.now() };
        if (dateFrom) filterParams.dateFrom = dateFrom;
        if (dateTo) filterParams.dateTo = dateTo;
        data = await fetchAllPages<Varisangya>((p) =>
          collectibleService.getAllVarisangyas({ ...filterParams, ...p })
        );
        total = data.length;
        hasPagination = true;
      } else {
        const result = await collectibleService.getAllVarisangyas({ page: currentPage, limit: itemsPerPage });
        data = result.data ?? [];
        total = result.pagination?.total ?? data.length;
        hasPagination = Boolean(result.pagination);
      }
      if (hasDateFilter) data = filterByDateRange(data, dateFrom, dateTo);
      if (hasFamilyFilter) {
        const q = familyNameFilter.trim().toLowerCase();
        data = data.filter((row) => getPayerName(row).toLowerCase().includes(q));
      }
      if (hasClientFilter) {
        total = data.length;
        const start = (currentPage - 1) * itemsPerPage;
        data = data.slice(start, start + itemsPerPage);
      }
      console.log('[Varisangya Filter] Response:', {
        count: data.length,
        total,
        firstPaymentDate: data[0]?.paymentDate,
      });
      console.log(
        '[Varisangya Filter] What the UI is showing (each row):',
        data.map((row, i) => ({
          no: i + 1,
          name:
            typeof row.memberId === 'object' && row.memberId?.name
              ? row.memberId.name
              : typeof row.familyId === 'object' && row.familyId?.houseName
                ? row.familyId.houseName
                : '-',
          amount: row.amount,
          paymentDate: row.paymentDate,
          receiptNo: row.receiptNo,
        }))
      );
      setVarisangyas(data);
      if (hasPagination) {
        setPagination({
          page: currentPage,
          total,
          totalPages: Math.max(1, Math.ceil(total / itemsPerPage)),
          limit: itemsPerPage,
        });
      }
    } catch (err: any) {
      setError(loadErrorMessage(err, 'varisangyas'));
      console.error('Error fetching varisangyas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);

      const filters: Record<string, unknown> = {};
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;
      // The endpoint caps limit at 100 and 400s above it, so a single
      // limit:10000 request always failed - page through instead.
      let dataToExport = await fetchAllPages<Varisangya>((p) =>
        collectibleService.getAllVarisangyas({ ...filters, ...p })
      );
      if (dateFrom || dateTo) dataToExport = filterByDateRange(dataToExport, dateFrom, dateTo);
      if (familyNameFilter.trim()) {
        const q = familyNameFilter.trim().toLowerCase();
        dataToExport = dataToExport.filter((row) => getPayerName(row).toLowerCase().includes(q));
      }

      if (dataToExport.length === 0) {
        toast.info('No varisangya data to export');
        return;
      }

      const filename = 'varisangya-payments';
      const title = 'Varisangya Payments';

      switch (type) {
        case 'csv':
          exportToCSV(columns, dataToExport, filename);
          break;
        case 'json':
          exportToJSON(columns, dataToExport, filename);
          break;
        case 'pdf':
          {
            const familyCache = new Map<string, string>();
            const memberCache = new Map<string, string>();

            const resolveFamilyName = async (familyId?: string) => {
              if (!familyId) return '-';
              if (familyCache.has(familyId)) return familyCache.get(familyId)!;
              const family = await familyService.getById(familyId);
              const name = family.houseName ? toTitleCase(family.houseName) : '-';
              familyCache.set(familyId, name);
              return name;
            };

            const resolveMemberName = async (memberId?: string) => {
              if (!memberId) return '-';
              if (memberCache.has(memberId)) return memberCache.get(memberId)!;
              const member = await memberService.getById(memberId);
              const name = member.name ? toTitleCase(member.name) : '-';
              memberCache.set(memberId, name);
              return name;
            };

            const invoices: InvoiceDetails[] = [];
            for (const entry of dataToExport) {
              const isMember = Boolean(entry.memberId);
              const payerName = isMember
                ? await resolveMemberName(getId(entry.memberId))
                : await resolveFamilyName(getId(entry.familyId));

              invoices.push({
                title: title,
                receiptNo: entry.receiptNo,
                payerLabel: isMember ? 'Member' : 'Family',
                payerName,
                amount: entry.amount,
                paymentDate: entry.paymentDate,
                paymentMethod: entry.paymentMethod,
                remarks: entry.remarks,
              });
            }

            await exportInvoicesToPdf(
              invoices,
              `varisangya-invoices-${new Date().toISOString().split('T')[0]}`
            );
          }
          break;
      }
    } catch (error: any) {
      toast.error(errorMessage(error, { action: 'export varisangya data' }));
    } finally {
      setIsExporting(false);
    }
  };

  const getId = (x: string | { id: string } | undefined): string | undefined =>
    x && typeof x === 'object' ? x.id : typeof x === 'string' ? x : undefined;
  const handleViewPdf = async (entry: Varisangya) => {
    try {
      let payerName: string | undefined;
      let payerLabel: string;

      const memberId = getId(entry.memberId);
      const familyId = getId(entry.familyId);

      if (entry.memberId && typeof entry.memberId === 'object' && entry.memberId.name) {
        payerName = entry.memberId.name;
        payerLabel = 'Member';
      } else if (memberId) {
        payerName = (await memberService.getById(memberId)).name;
        payerLabel = 'Member';
      } else if (entry.familyId && typeof entry.familyId === 'object' && entry.familyId.houseName) {
        payerName = entry.familyId.houseName;
        payerLabel = 'Family';
      } else if (familyId) {
        payerName = (await familyService.getById(familyId)).houseName;
        payerLabel = 'Family';
      } else {
        payerName = '-';
        payerLabel = 'Unknown';
      }

      const invoiceDetails: InvoiceDetails = {
        title: 'Varisangya Payment',
        receiptNo: entry.receiptNo,
        payerLabel,
        payerName: payerName ? toTitleCase(payerName) : '-',
        amount: entry.amount,
        paymentDate: entry.paymentDate,
        paymentMethod: entry.paymentMethod,
        remarks: entry.remarks,
      };

      await downloadInvoicePdf(invoiceDetails);
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast.error(error?.message || "Couldn't generate PDF");
    }
  };

  const openEdit = (row: Varisangya) => {
    setEditingRow(row);
    setEditForm({
      amount: row.amount ?? 0,
      paymentDate: row.paymentDate ? new Date(row.paymentDate).toISOString().split('T')[0] : '',
      paymentMethod: row.paymentMethod ?? '',
      remarks: row.remarks ?? '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editingRow?.id) return;
    try {
      setSavingEdit(true);
      await collectibleService.updateVarisangya(editingRow.id, {
        amount: editForm.amount,
        paymentDate: editForm.paymentDate,
        paymentMethod: editForm.paymentMethod || undefined,
        remarks: editForm.remarks || undefined,
      });
      setEditingRow(null);
      await fetchVarisangyas();
      toast.success('Varisangya payment updated');
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'update varisangya payment' }));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleVerify = async (row: Varisangya) => {
    try {
      await collectibleService.verifyVarisangya(row.id);
      toast.success('Varisangya verified');
      await fetchVarisangyas();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'verify varisangya' }));
    }
  };

  const columns = buildVarisangyaColumns({ openEdit, handleViewPdf, onVerify: handleVerify });

  const totalAmount = varisangyas.reduce((sum, v) => sum + (v.amount || 0), 0);

  const stats = [
    {
      title: 'Total Payments',
      value: pagination?.total || varisangyas.length,
      icon: <FiCreditCard className="h-5 w-5" />,
    },
    {
      title: 'Total Amount',
      value: `₹${totalAmount.toLocaleString()}`,
      icon: <FiDollarSign className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <PageHeader title="Varisangyas" description="Manage varisangya payments" />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
          isFilterVisible={isFilterVisible}
          hasFilters={true}
          onRefresh={fetchVarisangyas}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={
            <Link to="/collectibles/varisangya/create">
              <Button size="md" icon={<FiPlus />} collapseLabel>New Payment</Button>
            </Link>
          }
        />

        {isFilterVisible && (
          <div className="relative flex flex-wrap items-end gap-4 p-4 mb-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800/50">
            <button
              type="button"
              onClick={() => setIsFilterVisible(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 sm:relative sm:right-0 sm:top-0 order-last sm:order-none"
              aria-label="Close filter"
            >
              <FiX className="h-4 w-4" />
            </button>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 flex-1">
              <Input
                label="Family name"
                type="text"
                value={familyNameFilter}
                onChange={(e) => {
                  setFamilyNameFilter(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Filter by name"
              />
              <Input
                label="From Date"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
              />
              <Input
                label="To Date"
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  const first = new Date(now.getFullYear(), now.getMonth(), 1);
                  const toLocal = (d: Date) =>
                    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  setDateFrom(toLocal(first));
                  setDateTo(toLocal(now));
                  setCurrentPage(1);
                }}
              >
                This month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                  const last = new Date(now.getFullYear(), now.getMonth(), 0);
                  const toLocal = (d: Date) =>
                    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  setDateFrom(toLocal(first));
                  setDateTo(toLocal(last));
                  setCurrentPage(1);
                }}
              >
                Last month
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                  setFamilyNameFilter('');
                  setCurrentPage(1);
                }}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <EmptyState
            variant="error"
            entity="varisangya payments"
            description={error}
            action={{ label: 'Retry', onClick: fetchVarisangyas }}
          />
        ) : (
          <Table
            fixedLayout
            striped
            columns={columns}
            data={varisangyas}
            emptyMessage="No varisangya payments found"
            showExport={false}
          />
        )}

        {/* Pagination */}
        {pagination && (
          <div className="mt-4">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={(page) => {
                setCurrentPage(page);
              }}
            />
          </div>
        )}
      </TableCard>

      <Modal
        isOpen={!!editingRow}
        onClose={() => setEditingRow(null)}
        title="Edit payment"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditingRow(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} isLoading={savingEdit}>
              Save
            </Button>
          </>
        }
      >
        {editingRow && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Receipt: {editingRow.receiptNo ?? '-'} · {toTitleCase(getPayerName(editingRow))}
            </p>
            <Input
              label="Amount"
              type="number"
              min={0}
              step={0.01}
              value={editForm.amount || ''}
              onChange={(e) => setEditForm((f) => ({ ...f, amount: parseFloat(e.target.value) || 0 }))}
            />
            <Input
              label="Payment Date"
              type="date"
              value={editForm.paymentDate}
              onChange={(e) => setEditForm((f) => ({ ...f, paymentDate: e.target.value }))}
            />
            <Input
              label="Payment Method"
              type="text"
              value={editForm.paymentMethod}
              onChange={(e) => setEditForm((f) => ({ ...f, paymentMethod: e.target.value }))}
              placeholder="e.g. cash"
            />
            <Input
              label="Remarks"
              type="text"
              value={editForm.remarks}
              onChange={(e) => setEditForm((f) => ({ ...f, remarks: e.target.value }))}
              placeholder="Optional"
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
