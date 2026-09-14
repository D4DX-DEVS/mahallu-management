import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiCheckCircle, FiCreditCard, FiDollarSign, FiPlus } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import { rowActionClass } from '@/components/ui/rowAction';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { collectibleService, Zakat } from '@/services/collectibleService';
import { fetchAllPages } from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate, toTitleCase } from '@/utils/format';
import { exportToCSV, exportToJSON } from '@/utils/exportUtils';
import { exportInvoicesToPdf, InvoiceDetails } from '@/utils/invoiceUtils';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

export default function ZakatList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [zakats, setZakats] = useState<Zakat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  // A page number that only made sense for the previous search must not
  // survive into the new one - reset it once the debounce settles.
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchZakats();
  }, [debouncedSearch, currentPage]);

  const fetchZakats = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
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
      setError(loadErrorMessage(err, 'zakats'));
      console.error('Error fetching zakats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);

      const filters: any = {};
      if (debouncedSearch) filters.search = debouncedSearch;

      // The endpoint caps limit at 100 and 400s above it, so a single
      // limit:10000 request always failed - page through instead.
      const dataToExport = await fetchAllPages<Zakat>((p) => collectibleService.getAllZakats({ ...filters, ...p }));

      if (dataToExport.length === 0) {
        toast.info('No zakat data to export');
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
              payerName: entry.payerName ? toTitleCase(entry.payerName) : '-',
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
      toast.error(errorMessage(error, { action: 'export zakat data' }));
    } finally {
      setIsExporting(false);
    }
  };

  const handleVerify = async (row: Zakat) => {
    try {
      await collectibleService.verifyZakat(row.id);
      toast.success('Zakat verified');
      await fetchZakats();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'verify zakat' }));
    }
  };

  const columns: TableColumn<Zakat>[] = [
    { key: 'payerName', label: 'Payer Name', width: '9.75rem', sortable: true, render: (v) => toTitleCase(v) },
    {
      key: 'amount',
      label: 'Amount',
      width: '9.25rem',
      align: 'center',
      render: (amount) => `₹${amount?.toLocaleString() || 0}`,
    },
    {
      key: 'paymentDate',
      label: 'Payment Date',
      width: '10.75rem',
      render: (date) => formatDate(date),
    },
    { key: 'category', label: 'Category', width: '8.25rem', render: (v) => (v ? toTitleCase(v) : '-') },
    {
      key: 'receiptNo',
      label: 'Receipt No.',
      width: '9.5rem',
      render: (receiptNo) => receiptNo || '-',
    },
    {
      key: 'status',
      label: 'Status',
      width: '7.25rem',
      render: (status) => (
        <span
          className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
            status === 'pending'
              ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          }`}
        >
          {status === 'pending' ? 'Pending' : 'Verified'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '8rem',
      align: 'center',
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {row.status === 'pending' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleVerify(row);
              }}
              className={rowActionClass()}
              title="Verify payment"
              aria-label="Verify payment"
            >
              <FiCheckCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const totalAmount = zakats.reduce((sum, z) => sum + (z.amount || 0), 0);

  const stats = [
    {
      title: 'Total Payments',
      value: pagination?.total || zakats.length,
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
        <PageHeader title="Zakat" description="Manage zakat payments" />

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
          hasFilters={false}
          onRefresh={fetchZakats}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={
            <Link to="/collectibles/zakat/create">
              <Button size="md" icon={<FiPlus />} collapseLabel>New Payment</Button>
            </Link>
          }
        />

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchZakats} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <Table fixedLayout striped columns={columns} data={zakats} emptyMessage="No zakat payments found" showExport={false} />
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
    </div>
  );
}
