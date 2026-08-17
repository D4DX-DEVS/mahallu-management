import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiDollarSign, FiCreditCard, FiCheckCircle } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { collectibleService, Zakat } from '@/services/collectibleService';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON } from '@/utils/exportUtils';
import { exportInvoicesToPdf, InvoiceDetails } from '@/utils/invoiceUtils';
import { toast } from '@/store/toastStore';

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
      setError(err.response?.data?.message || 'Failed to fetch zakats');
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
      toast.error(error?.message || 'Failed to export zakat data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleVerify = async (row: Zakat) => {
    try {
      await collectibleService.verifyZakat(row.id);
      toast.success('Zakat verified successfully');
      await fetchZakats();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to verify zakat');
    }
  };

  const columns: TableColumn<Zakat>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'payerName', label: 'Payer Name', sortable: true },
    {
      key: 'amount',
      label: 'Amount',
      render: (amount) => `₹${amount?.toLocaleString() || 0}`,
    },
    {
      key: 'paymentDate',
      label: 'Payment Date',
      render: (date) => formatDate(date),
    },
    { key: 'category', label: 'Category' },
    {
      key: 'receiptNo',
      label: 'Receipt No.',
      render: (receiptNo) => receiptNo || '-',
    },
    {
      key: 'status',
      label: 'Status',
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
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {row.status === 'pending' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleVerify(row);
              }}
              className="p-1.5 rounded-md hover:bg-green-100 dark:hover:bg-green-900 text-green-600 dark:text-green-400 transition-colors"
              title="Verify payment"
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
    { title: 'Total Payments', value: pagination?.total || zakats.length, icon: <FiCreditCard className="h-5 w-5" /> },
    { title: 'Total Amount', value: `₹${totalAmount.toLocaleString()}`, icon: <FiDollarSign className="h-5 w-5" /> },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Zakat</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Manage zakat payments</p>
          </div>
          <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Zakat' }]} />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      <Card>
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
              <Button size="md">
                + New Payment
              </Button>
            </Link>
          }
        />

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchZakats} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <Table columns={columns} data={zakats} emptyMessage="No zakat payments found" showExport={false} />
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
      </Card>
    </div>
  );
}

