import { useState, useEffect } from 'react';
import SavedViews from '@/components/ui/SavedViews';
import AppliedFilters from '@/components/ui/AppliedFilters';
import TableColumnMenu from '@/components/ui/TableColumnMenu';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useTableView } from '@/hooks/useTableView';
import { Link } from 'react-router-dom';
import { FiDollarSign, FiCreditCard, FiRefreshCw, FiDownload, FiFileText, FiFile, FiPrinter } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import Dropdown from '@/components/ui/Dropdown';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import StatusBadge from '@/components/ui/StatusBadge';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { collectibleService, Zakat } from '@/services/collectibleService';
import { CancelReceiptDialog, ReceiptDetailModal, ReceiptStatusBadge, useReceiptPermissions, isCancelled } from '../receiptUi';
import { printReceipt } from '../receiptPrint';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON } from '@/utils/exportUtils';
import { exportInvoicesToPdf, InvoiceDetails } from '@/utils/invoiceUtils';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { monthlySeries } from '@/utils/statSeries';

export default function ZakatList() {
  const filters = useUrlFilters({});
  const { search: searchQuery, setSearch: setSearchQuery, debouncedSearch, page: currentPage, setPage: setCurrentPage, pageSize: itemsPerPage } = filters;
  const [zakats, setZakats] = useState<Zakat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const { canCancel } = useReceiptPermissions();
  const [detailRow, setDetailRow] = useState<Zakat | null>(null);
  const [cancelRow, setCancelRow] = useState<Zakat | null>(null);


  useEffect(() => {
    fetchZakats();
  }, [debouncedSearch, currentPage, itemsPerPage]);

  const fetchZakats = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        includeCancelled: true,
        page: currentPage,
        limit: itemsPerPage,
      };
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      const result = await collectibleService.getAllZakats(params);
      setZakats(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load zakats. Refresh the page or try again."));
      console.error('Error fetching zakats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      
      const params: any = { limit: 10000 };
      if (debouncedSearch) params.search = debouncedSearch;
      
      const result = await collectibleService.getAllZakats(params);
      const dataToExport = result.data;

      if (dataToExport.length === 0) {
        toast.info('Nothing to export. Change your filters and try again.');
        return;
      }

      const filename = 'zakat-payments';
      const title = 'Zakat Payments';

      switch (type) {
        case 'csv':
          exportToCSV(columns, dataToExport, filename);
          break;
        case 'json':
          exportToJSON(columns, dataToExport, filename);
          break;
        case 'pdf':
          {
            const invoices: InvoiceDetails[] = dataToExport.map((entry) => ({
              title: title,
              receiptNo: entry.receiptNo,
              payerLabel: 'Payer',
              payerName: entry.payerName || '-',
              amount: entry.amount,
              paymentDate: entry.paymentDate,
              paymentMethod: entry.paymentMethod,
              remarks: entry.remarks,
            }));
            await exportInvoicesToPdf(invoices, `zakat-invoices-${new Date().toISOString().split('T')[0]}`);
          }
          break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(getFriendlyError(error, "Couldn't export zakat data. Check your connection and try again."));
    } finally {
      setIsExporting(false);
    }
  };

  const handleReprint = async (entry: Zakat) => {
    try {
      await printReceipt(
        {
          title: 'Zakat Payment',
          receiptNo: entry.receiptNo,
          payerLabel: 'Payer',
          payerName: entry.payerName || '-',
          amount: entry.amount,
          paymentDate: entry.paymentDate,
          paymentMethod: entry.paymentMethod,
          remarks: entry.remarks,
          receiptRef: { type: 'zakat', id: entry.id },
        },
        { forceDuplicate: true }
      );
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't generate PDF. Try again in a moment."));
    }
  };

  const handleCancel = async (reason: string) => {
    if (!cancelRow) return;
    await collectibleService.cancelReceipt('zakat', cancelRow.id, reason);
    toast.success(`Receipt ${cancelRow.receiptNo ?? ''} cancelled. The amounts are reversed and the number is kept.`);
    setCancelRow(null);
    setDetailRow(null);
    await fetchZakats();
  };

  const columns: TableColumn<Zakat>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'payerName', label: 'Payer Name', sortable: true, render: (name) => <PersonCell name={name} /> },
    {
      key: 'amount',
      label: 'Amount',
      align: 'right',
      render: (amount) => `₹${amount?.toLocaleString() || 0}`,
    },
    {
      key: 'paymentDate',
      label: 'Payment Date',
      render: (date) => formatDate(date),
    },
    { key: 'category', label: 'Category', render: (c) => (c ? <StatusBadge tone="neutral" dot={false} status={c} /> : '-') },
    {
      key: 'receiptNo',
      label: 'Receipt No.',
      render: (receiptNo) => receiptNo || '-',
    },
    { key: 'status', label: 'Status', render: (_, row) => <ReceiptStatusBadge row={row} /> },
    {
      key: 'actions',
      label: 'Actions',
      hideable: false,
      render: (_, row) =>
        isCancelled(row) ? null : (
          <RowActions
            onDelete={canCancel ? () => setCancelRow(row) : undefined}
            deleteLabel="Cancel receipt"
            extra={[{ label: 'Reprint (duplicate)', icon: <FiPrinter />, onClick: () => handleReprint(row) }]}
          />
        ),
    },
  ];
  const view = useTableView('zakat', columns);

  const totalAmount = zakats.reduce((sum, z) => sum + (isCancelled(z) ? 0 : z.amount || 0), 0);

  const countSeries = monthlySeries(zakats, (z) => z.paymentDate);
  const amountSeries = monthlySeries(zakats, (z) => z.paymentDate, (z) => z.amount);
  const stats = [
    { title: 'Total Payments', value: pagination?.total || zakats.length, icon: <FiCreditCard className="h-[17px] w-[17px]" />, tone: 'gold' as const, viz: countSeries.length ? { type: 'bars' as const, values: countSeries, color: '#E0B400' } : undefined },
    { title: 'Total Amount', value: `₹${totalAmount.toLocaleString()}`, icon: <FiDollarSign className="h-[17px] w-[17px]" />, tone: 'gold' as const, viz: amountSeries.length ? { type: 'area' as const, values: amountSeries, color: '#E0B400' } : undefined },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <PageHeader
          title="Zakat"
          description="Manage zakat payments"
          actions={
            <>
              <Link to="/collectibles/zakat/create">
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
              <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={fetchZakats}>
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
          <SavedViews pageKey="zakat" filters={filters} />
        </FilterBar>
        <AppliedFilters filters={filters} />

        <div className="p-3.5">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchZakats} className="mt-4" variant="secondary">
              Retry
            </Button>
          </div>
        ) : (
          <Table
            columns={view.columns}
            density={view.density}
            data={zakats}
            emptyMessage="No zakat payments found"
            showExport={false}
            onRowClick={(row) => setDetailRow(row)}
            filtersActive={filters.activeCount > 0}
            onClearFilters={filters.clear}
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
        title={detailRow?.payerName || 'Zakat receipt'}
        row={detailRow}
        fields={detailRow ? [{ label: 'Category', value: detailRow.category }] : []}
        onReprint={() => detailRow && handleReprint(detailRow)}
        onCancel={() => detailRow && setCancelRow(detailRow)}
      />

      <CancelReceiptDialog
        isOpen={!!cancelRow}
        receiptNo={cancelRow?.receiptNo}
        payer={cancelRow?.payerName}
        onClose={() => setCancelRow(null)}
        onConfirm={handleCancel}
      />
    </div>
  );
}

