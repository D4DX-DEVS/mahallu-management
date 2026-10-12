import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiCreditCard, FiDollarSign, FiDownload, FiX, FiFilter, FiRefreshCw, FiFileText, FiFile } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import DateRangePicker from '@/components/ui/DateRangePicker';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import Modal from '@/components/ui/Modal';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import Dropdown from '@/components/ui/Dropdown';
import SavedViews from '@/components/ui/SavedViews';
import AppliedFilters from '@/components/ui/AppliedFilters';
import TableColumnMenu from '@/components/ui/TableColumnMenu';
import BulkBarButton from '@/components/ui/BulkBarButton';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useTableView } from '@/hooks/useTableView';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { collectibleService, Varisangya } from '@/services/collectibleService';
import {
  buildVarisangyaColumns,
  getPayerName,
  getFamilyName,
} from '../varisangyaColumns';
import { filterByDateRange } from '../varisangyaFilters';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON } from '@/utils/exportUtils';
import { exportInvoicesToPdf, InvoiceDetails } from '@/utils/invoiceUtils';
import { CancelReceiptDialog, ReceiptDetailModal, useReceiptPermissions, isCancelled } from '../receiptUi';
import { printReceipt } from '../receiptPrint';
import { familyService } from '@/services/familyService';
import { memberService } from '@/services/memberService';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { monthlySeries } from '@/utils/statSeries';

export default function VarisangyaList() {
  const filters = useUrlFilters({ from: '', to: '', family: '' });
  const { search: searchQuery, setSearch: setSearchQuery, debouncedSearch, page: currentPage, setPage: setCurrentPage, pageSize: itemsPerPage } = filters;
  const dateFrom = filters.values.from;
  const dateTo = filters.values.to;
  const familyNameFilter = filters.values.family;
  const setDateFrom = (v: string) => filters.setFilter('from', v);
  const setDateTo = (v: string) => filters.setFilter('to', v);
  const setFamilyNameFilter = (v: string) => filters.setFilter('family', v, { replace: true });
  const [isFilterVisible, setIsFilterVisible] = useState(() => Boolean(filters.values.from || filters.values.to || filters.values.family));
  const [varisangyas, setVarisangyas] = useState<Varisangya[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [editingRow, setEditingRow] = useState<Varisangya | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const { canCancel } = useReceiptPermissions();
  const [detailRow, setDetailRow] = useState<Varisangya | null>(null);
  const [cancelRow, setCancelRow] = useState<Varisangya | null>(null);
  const [editForm, setEditForm] = useState({ amount: 0, paymentDate: '', paymentMethod: '', remarks: '' });

  useEffect(() => {
    fetchVarisangyas();
  }, [currentPage, itemsPerPage, dateFrom, dateTo, familyNameFilter, debouncedSearch]);

  const fetchVarisangyas = async () => {
    try {
      setLoading(true);
      setError(null);
      const hasDateFilter = Boolean(dateFrom || dateTo);
      const hasFamilyFilter = familyNameFilter.trim().length > 0;
      const hasSearch = debouncedSearch.trim().length > 0;
      const hasClientFilter = hasDateFilter || hasFamilyFilter || hasSearch;
      const params: Record<string, unknown> = {
        includeCancelled: true,
        page: hasClientFilter ? 1 : currentPage,
        limit: hasClientFilter ? 10000 : itemsPerPage,
      };
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      if (hasClientFilter) params._t = Date.now();
      const result = await collectibleService.getAllVarisangyas(params);
      let data = result.data ?? [];
      let total = result.pagination?.total ?? data.length;
      if (hasDateFilter) data = filterByDateRange(data, dateFrom, dateTo);
      if (hasFamilyFilter) {
        const q = familyNameFilter.trim().toLowerCase();
        data = data.filter((row) => getPayerName(row).toLowerCase().includes(q));
      }
      if (hasSearch) {
        const q = debouncedSearch.trim().toLowerCase();
        data = data.filter((row) => getPayerName(row).toLowerCase().includes(q) || getFamilyName(row).toLowerCase().includes(q) || String(row.receiptNo ?? '').toLowerCase().includes(q));
      }
      if (hasClientFilter) {
        total = data.length;
        const start = (currentPage - 1) * itemsPerPage;
        data = data.slice(start, start + itemsPerPage);
      }
      console.log('[Varisangya Filter] Response:', { count: data.length, total, firstPaymentDate: data[0]?.paymentDate });
      console.log('[Varisangya Filter] What the UI is showing (each row):', data.map((row, i) => ({
        no: i + 1,
        name: typeof row.memberId === 'object' && row.memberId?.name ? row.memberId.name : typeof row.familyId === 'object' && row.familyId?.houseName ? row.familyId.houseName : '-',
        amount: row.amount,
        paymentDate: row.paymentDate,
        receiptNo: row.receiptNo,
      })));
      setVarisangyas(data);
      if (result.pagination) {
        setPagination({
          ...result.pagination,
          page: currentPage,
          total,
          totalPages: Math.max(1, Math.ceil(total / itemsPerPage)),
          limit: itemsPerPage,
        });
      }
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load varisangyas. Refresh the page or try again."));
      console.error('Error fetching varisangyas:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      
      const params: Record<string, unknown> = { limit: 10000 };
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;
      const result = await collectibleService.getAllVarisangyas(params);
      let dataToExport = result.data ?? [];
      if (dateFrom || dateTo) dataToExport = filterByDateRange(dataToExport, dateFrom, dateTo);
      if (familyNameFilter.trim()) {
        const q = familyNameFilter.trim().toLowerCase();
        dataToExport = dataToExport.filter((row) => getPayerName(row).toLowerCase().includes(q));
      }

      if (dataToExport.length === 0) {
        toast.info('Nothing to export. Change your filters and try again.');
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
              const name = family.houseName || '-';
              familyCache.set(familyId, name);
              return name;
            };

            const resolveMemberName = async (memberId?: string) => {
              if (!memberId) return '-';
              if (memberCache.has(memberId)) return memberCache.get(memberId)!;
              const member = await memberService.getById(memberId);
              const name = member.name || '-';
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

            await exportInvoicesToPdf(invoices, `varisangya-invoices-${new Date().toISOString().split('T')[0]}`);
          }
          break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(getFriendlyError(error, "Couldn't export varisangya data. Check your connection and try again."));
    } finally {
      setIsExporting(false);
    }
  };

  const getId = (x: string | { id: string } | undefined): string | undefined =>
    x && typeof x === 'object' ? x.id : (typeof x === 'string' ? x : undefined);
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
        payerName: payerName || '-',
        amount: entry.amount,
        paymentDate: entry.paymentDate,
        paymentMethod: entry.paymentMethod,
        remarks: entry.remarks,
        receiptRef: { type: 'varisangya', id: entry.id },
      };

      // Logged on the server; anything after the first print is stamped DUPLICATE
      await printReceipt(invoiceDetails, { forceDuplicate: true });
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast.error(getFriendlyError(error, "Couldn't generate PDF. Try again in a moment."));
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
      toast.error(getFriendlyError(err, "Couldn't update varisangya payment. Try again in a moment."));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCancel = async (reason: string) => {
    if (!cancelRow) return;
    await collectibleService.cancelReceipt('varisangya', cancelRow.id, reason);
    toast.success(`Receipt ${cancelRow.receiptNo ?? ''} cancelled. The amounts are reversed and the number is kept.`);
    setCancelRow(null);
    setDetailRow(null);
    await fetchVarisangyas();
  };

  const columns = buildVarisangyaColumns({ openEdit, handleViewPdf, openCancel: setCancelRow, canCancel });
  const view = useTableView('varisangya', columns);
  const exportSelected = (ids: string[]) => {
    const rows = varisangyas.filter((v) => ids.includes(String(v.id)));
    exportToCSV(columns.filter((c) => c.key !== 'actions'), rows, 'varisangya-selected');
    toast.success(`Exported ${rows.length} ${rows.length === 1 ? 'payment' : 'payments'}`);
  };

  const totalAmount = varisangyas.reduce((sum, v) => sum + (isCancelled(v) ? 0 : v.amount || 0), 0);

  const countSeries = monthlySeries(varisangyas, (v) => v.paymentDate);
  const amountSeries = monthlySeries(varisangyas, (v) => v.paymentDate, (v) => v.amount);
  const stats = [
    { title: 'Total Payments', value: pagination?.total || varisangyas.length, icon: <FiCreditCard className="h-[17px] w-[17px]" />, viz: countSeries.length ? { type: 'bars' as const, values: countSeries } : undefined },
    { title: 'Total Amount', value: `₹${totalAmount.toLocaleString()}`, icon: <FiDollarSign className="h-[17px] w-[17px]" />, tone: 'lime' as const, viz: amountSeries.length ? { type: 'area' as const, values: amountSeries } : undefined },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <PageHeader
          title="Varisangyas"
          description="Manage varisangya payments"
          actions={
            <>
              <Link to="/collectibles/varisangya/create">
                <Button>
                  + New Payment
                </Button>
              </Link>
            </>
          }
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {stats.map((stat, index) => (
            <StatCard key={index} variant="inline" {...stat} />
          ))}
        </div>
      </div>

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search payments' }}
          actions={
            <>
              <Button variant={isFilterVisible ? 'soft' : 'secondary'} onClick={() => setIsFilterVisible(!isFilterVisible)}>
                <FiFilter className="h-3.5 w-3.5" />
                Filter
              </Button>
              <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={fetchVarisangyas}>
                <FiRefreshCw className="h-3.5 w-3.5" />
              </Button>
              <TableColumnMenu {...view.menuProps} />
              <Dropdown
                trigger={
                  <Button variant="secondary" isLoading={isExporting}>
                    {!isExporting && <FiDownload className="h-3.5 w-3.5" />}
                    Export
                  </Button>
                }
                items={[
                  { label: 'Export CSV', icon: <FiFileText />, onClick: () => handleExport('csv'), disabled: isExporting },
                  { label: 'Export JSON', icon: <FiFile />, onClick: () => handleExport('json'), disabled: isExporting },
                  { label: 'Export PDF', icon: <FiDownload />, onClick: () => handleExport('pdf'), disabled: isExporting },
                ]}
              />
            </>
          }
        >
          <SavedViews pageKey="varisangya" filters={filters} />
        </FilterBar>
        <AppliedFilters
          filters={filters}
          config={{ from: { label: 'From' }, to: { label: 'To' }, family: { label: 'Family' } }}
        />
        {isFilterVisible && (
          <div className="flex flex-wrap items-end gap-4 border-b border-line-soft bg-[#F4F7F5] px-3.5 py-3 dark:border-surface-border dark:bg-surface-base">
            <button
              type="button"
              onClick={() => setIsFilterVisible(false)}
              className="text-[#98A59F] hover:text-[#3A4741] sm:relative sm:right-0 sm:top-0 order-last sm:order-none"
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
                }}
                placeholder="Filter by name"
              />
              <div className="sm:col-span-2">
                <DateRangePicker
                  label="Date range"
                  from={dateFrom}
                  to={dateTo}
                  onChange={(f, t) => {
                    setDateFrom(f);
                    setDateTo(t);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
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
                variant="secondary"
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
                variant="secondary"
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

        <div className="p-3.5">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchVarisangyas} className="mt-4" variant="secondary">
              Retry
            </Button>
          </div>
        ) : (
          <Table
            columns={view.columns}
            density={view.density}
            data={varisangyas}
            emptyMessage="No varisangya payments found"
            showExport={false}
            selectable
            onRowClick={(row) => setDetailRow(row)}
            filtersActive={filters.activeCount > 0}
            onClearFilters={filters.clear}
            bulkActions={(ids) => (
              <BulkBarButton onClick={() => exportSelected(ids)}>
                <FiDownload className="h-3.5 w-3.5" /> Export selected
              </BulkBarButton>
            )}
          />
        )}

        {/* Pagination */}
        {pagination && (
          <div className="mt-3.5">
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
        </div>
      </Card>

      <ReceiptDetailModal
        isOpen={!!detailRow}
        onClose={() => setDetailRow(null)}
        title={detailRow ? getPayerName(detailRow) : ''}
        row={detailRow}
        fields={detailRow ? [{ label: 'Family', value: getFamilyName(detailRow) }] : []}
        canEdit
        onEdit={() => {
          if (detailRow) openEdit(detailRow);
          setDetailRow(null);
        }}
        onReprint={() => detailRow && handleViewPdf(detailRow)}
        onCancel={() => detailRow && setCancelRow(detailRow)}
      />

      <CancelReceiptDialog
        isOpen={!!cancelRow}
        receiptNo={cancelRow?.receiptNo}
        payer={cancelRow ? getPayerName(cancelRow) : undefined}
        onClose={() => setCancelRow(null)}
        onConfirm={handleCancel}
      />

      <Modal
        isOpen={!!editingRow}
        onClose={() => setEditingRow(null)}
        title="Edit payment"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditingRow(null)}>
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
            <p className="text-sm text-[#5B6963] dark:text-surface-muted">
              Receipt: {editingRow.receiptNo ?? '-'} · {getPayerName(editingRow)}
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

