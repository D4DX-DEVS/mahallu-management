import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiCreditCard, FiDollarSign, FiPlus } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import FilterPanel from '@/components/ui/FilterPanel';
import { useDebounce } from '@/hooks/useDebounce';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { TableColumn, Pagination as PaginationType } from '@/types';
import {
  collectibleService,
  Varisangya,
  CollectionSummary,
  EMPTY_COLLECTION_SUMMARY,
  summarizeCollectionRows,
} from '@/services/collectibleService';
import { fetchAllPages } from '@/services/api';
import { buildVarisangyaColumns, getPayerName, getFamilyName } from '../varisangyaColumns';
import { filterByDateRange } from '../varisangyaFilters';
import { formatDate, toTitleCase } from '@/utils/format';
import { exportToCSV, exportToJSON } from '@/utils/exportUtils';
import { exportInvoicesToPdf, downloadInvoicePdf, InvoiceDetails } from '@/utils/invoiceUtils';
import { familyService } from '@/services/familyService';
import { memberService } from '@/services/memberService';
import { toast } from '@/store/toastStore';
import { errorMessage, isConflict, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { logError } from '@/utils/safeLog';

export default function VarisangyaList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  // The toolbar search is the payer-name filter. It runs in the browser over every row, so it is debounced.
  const debouncedSearch = useDebounce(searchQuery, 500);
  const familyNameFilter = debouncedSearch;
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [varisangyas, setVarisangyas] = useState<Varisangya[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  /* Totals for the whole filtered set (every page), from the server. */
  const [summary, setSummary] = useState<CollectionSummary>(EMPTY_COLLECTION_SUMMARY);
  const [isExporting, setIsExporting] = useState(false);
  const [editingRow, setEditingRow] = useState<Varisangya | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editForm, setEditForm] = useState({ amount: 0, paymentDate: '', paymentMethod: '', remarks: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<Varisangya | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [verifyConfirm, setVerifyConfirm] = useState<Varisangya | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchVarisangyas();
  }, [currentPage, dateFrom, dateTo, familyNameFilter, itemsPerPage]);

  const fetchVarisangyas = async () => {
    try {
      setLoading(true);
      setError(null);
      const hasFamilyFilter = familyNameFilter.trim().length > 0;
      // The date range is filtered by the server, which also totals the whole range.
      const dateParams: { dateFrom?: string; dateTo?: string } = {};
      if (dateFrom) dateParams.dateFrom = dateFrom;
      if (dateTo) dateParams.dateTo = dateTo;
      let data: Varisangya[];
      let total: number;
      let hasPagination: boolean;
      if (hasFamilyFilter) {
        // The name filter runs in the browser, so it needs every row in the date
        // range, not one page. The endpoint caps limit at 100 - page through
        // instead. Every row is in hand, so the totals are summed from them.
        const all = await fetchAllPages<Varisangya>((p) =>
          collectibleService.getAllVarisangyas({ ...dateParams, ...p })
        );
        const q = familyNameFilter.trim().toLowerCase();
        const matching = all.filter((row) => getPayerName(row).toLowerCase().includes(q));
        setSummary(summarizeCollectionRows(matching));
        total = matching.length;
        const start = (currentPage - 1) * itemsPerPage;
        data = matching.slice(start, start + itemsPerPage);
        hasPagination = true;
      } else {
        // Server paging: the summary covers the whole filtered set, so the cards
        // stay right when only the page changes.
        const result = await collectibleService.getAllVarisangyas({
          ...dateParams,
          page: currentPage,
          limit: itemsPerPage,
        });
        data = result.data ?? [];
        total = result.pagination?.total ?? data.length;
        hasPagination = Boolean(result.pagination);
        setSummary(result.summary);
      }
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
      logError('Error fetching varisangyas', err);
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
      logError('Error generating PDF', error);
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

  const handleVerify = async () => {
    if (!verifyConfirm?.id) return;
    try {
      setVerifying(true);
      await collectibleService.verifyVarisangya(verifyConfirm.id);
      toast.success('Varisangya verified');
      setVerifyConfirm(null);
      await fetchVarisangyas();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'verify varisangya' }));
      if (isConflict(err)) {
        // Already processed elsewhere: close the dialog and show the row as it is now.
        setVerifyConfirm(null);
        await fetchVarisangyas();
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm?.id) return;
    try {
      setDeleting(true);
      await collectibleService.deleteVarisangya(deleteConfirm.id);
      toast.success('Varisangya payment deleted');
      setDeleteConfirm(null);
      await fetchVarisangyas();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete varisangya payment' }));
    } finally {
      setDeleting(false);
    }
  };

  const columns = buildVarisangyaColumns({
    openEdit,
    handleViewPdf,
    onVerify: (row) => setVerifyConfirm(row),
    onDelete: (row) => setDeleteConfirm(row),
  });

  const stats = [
    {
      title: 'Total Payments',
      value: summary.count,
      icon: <FiCreditCard className="h-5 w-5" />,
    },
    {
      title: 'Total Amount',
      value: `₹${summary.totalAmount.toLocaleString()}`,
      icon: <FiDollarSign className="h-5 w-5" />,
    },
  ];

  const activeFilterCount = [dateFrom, dateTo].filter(Boolean).length;
  const isFiltered = Boolean(debouncedSearch) || activeFilterCount > 0;

  return (
    <>
      <PageHeader
        title="Varisangyas"
        description="Manage varisangya payments."
        actions={
          <Link to="/collectibles/varisangya/create">
            <Button icon={<FiPlus />} collapseLabel>New payment</Button>
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchEntity="payers"
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={activeFilterCount}
          onRefresh={fetchVarisangyas}
          onExport={handleExport}
          isExporting={isExporting}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-44">
              <Input
                label="From date"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="w-full sm:w-44">
              <Input
                label="To date"
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <Button
              variant="outline"
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
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                onClick={() => {
                  setDateFrom('');
                  setDateTo('');
                  setCurrentPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterPanel>
        )}

        {error ? (
          <EmptyState
            variant="error"
            entity="varisangya payments"
            description={error}
            action={{ label: 'Try again', onClick: fetchVarisangyas }}
          />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={varisangyas}
              isLoading={loading}
              entity="varisangya payments"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); setDateFrom(''); setDateTo(''); setCurrentPage(1); } }
                  : { label: 'New payment', onClick: () => navigate('/collectibles/varisangya/create') }
              }
              onRowClick={(row) => openEdit(row)}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="varisangya payments"
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

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        title={deleteConfirm ? `Delete payment from ${toTitleCase(getPayerName(deleteConfirm))}?` : 'Delete this payment?'}
        message={`This permanently removes the ₹${(deleteConfirm?.amount ?? 0).toLocaleString('en-IN')} payment and cannot be undone.`}
        confirmLabel="Delete payment"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteConfirm(null)}
      />

      <ConfirmDialog
        isOpen={!!verifyConfirm}
        title="Verify this payment?"
        message={`This will mark the varisangya payment from ${verifyConfirm ? toTitleCase(getPayerName(verifyConfirm)) : 'this payer'} as verified.`}
        confirmLabel="Verify payment"
        variant="primary"
        isLoading={verifying}
        onConfirm={handleVerify}
        onCancel={() => setVerifyConfirm(null)}
      />
    </>
  );
}
