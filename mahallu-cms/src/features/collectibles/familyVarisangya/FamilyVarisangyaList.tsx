import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEye, FiDollarSign, FiHome, FiCreditCard, FiDownload } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import Dropdown, { DropdownItem } from '@/components/ui/Dropdown';
import { TableColumn, Pagination as PaginationType, Family } from '@/types';
import { familyService } from '@/services/familyService';
import { collectibleService } from '@/services/collectibleService';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/format';
import { ROUTES } from '@/constants/routes';
import { exportToCSV, exportToJSON } from '@/utils/exportUtils';
import { exportInvoicesToPdf, InvoiceDetails } from '@/utils/invoiceUtils';
import { toast } from '@/store/toastStore';
import { loadErrorMessage } from '@/utils/errors';

interface FamilyVarisangyaData extends Family {
  totalVarisangya?: number;
  varisangyaCount?: number;
  lastPaymentDate?: string;
}

const FAMILY_BASE = ROUTES.COLLECTIBLES.FAMILY_VARISANGYA.BASE;

const getFamilyId = (v: any) =>
  typeof v.familyId === 'object' && v.familyId != null ? (v.familyId as any).id : v.familyId;

export default function FamilyVarisangyaList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [families, setFamilies] = useState<FamilyVarisangyaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingRowId, setExportingRowId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchFamilies();
  }, [debouncedSearch, currentPage]);

  const fetchFamilies = async () => {
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

      const familiesResult = await familyService.getAll(params);
      const familiesData = familiesResult.data;
      const varisangyasResult = await collectibleService.getAllVarisangyas();
      const allVarisangyas = varisangyasResult.data;

      const familiesWithVarisangya = familiesData.map((family) => {
        const fid = (family as any).id ?? (family as any)._id;
        const familyVarisangyas = allVarisangyas.filter((v) => getFamilyId(v) === fid);
        const totalVarisangya = familyVarisangyas.reduce((sum, v) => sum + (v.amount || 0), 0);
        const lastPayment = familyVarisangyas.sort(
          (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
        )[0];
        return {
          ...family,
          totalVarisangya,
          varisangyaCount: familyVarisangyas.length,
          lastPaymentDate: lastPayment?.paymentDate,
        };
      });

      setFamilies(familiesWithVarisangya);
      if (familiesResult.pagination) {
        setPagination(familiesResult.pagination);
      }
    } catch (err: any) {
      setError(loadErrorMessage(err, 'families'));
      console.error('Error fetching families:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      const params: any = { limit: 10000 };
      if (debouncedSearch) params.search = debouncedSearch;
      const familiesResult = await familyService.getAll(params);
      const familiesData = familiesResult.data;
      const varisangyasResult = await collectibleService.getAllVarisangyas();
      const allVarisangyas = varisangyasResult.data;
      const dataToExport = familiesData.map((family) => {
        const familyVarisangyas = allVarisangyas.filter((v) => getFamilyId(v) === family.id);
        const totalVarisangya = familyVarisangyas.reduce((sum, v) => sum + (v.amount || 0), 0);
        const lastPayment = familyVarisangyas.sort(
          (a, b) => new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime()
        )[0];
        return {
          ...family,
          totalVarisangya,
          varisangyaCount: familyVarisangyas.length,
          lastPaymentDate: lastPayment?.paymentDate,
        };
      });
      if (dataToExport.length === 0) {
        toast.info('No family varisangya data to export');
        return;
      }
      switch (type) {
        case 'csv':
          exportToCSV(columns, dataToExport, 'family-varisangya');
          break;
        case 'json':
          exportToJSON(columns, dataToExport, 'family-varisangya');
          break;
        case 'pdf':
          {
            const invoices: InvoiceDetails[] = [];
            for (const family of familiesData) {
              const familyVarisangyas = allVarisangyas.filter((v) => getFamilyId(v) === family.id);
              for (const entry of familyVarisangyas) {
                invoices.push({
                  title: 'Family Varisangya Payment',
                  receiptNo: entry.receiptNo,
                  payerLabel: 'Family',
                  payerName: family.houseName || '-',
                  amount: entry.amount,
                  paymentDate: entry.paymentDate,
                  paymentMethod: entry.paymentMethod,
                  remarks: entry.remarks,
                });
              }
            }
            await exportInvoicesToPdf(
              invoices,
              `family-varisangya-invoices-${new Date().toISOString().split('T')[0]}`
            );
          }
          break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error?.message || "Couldn't export family varisangya data");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportRow = async (row: FamilyVarisangyaData, type: 'csv' | 'json' | 'pdf') => {
    try {
      setExportingRowId(row.id);
      const filename = `family-varisangya-${(row.houseName || row.id).replace(/\s+/g, '-')}`;
      const singleRow = [row];

      switch (type) {
        case 'csv':
          exportToCSV(columns, singleRow, filename);
          break;
        case 'json':
          exportToJSON(columns, singleRow, filename);
          break;
        case 'pdf':
          {
            const varisangyasResult = await collectibleService.getAllVarisangyas({ familyId: row.id });
            const familyVarisangyas = varisangyasResult.data || [];
            if (familyVarisangyas.length === 0) {
              toast.info('No payment records to export for this family');
              return;
            }
            const invoices: InvoiceDetails[] = familyVarisangyas.map((entry: any) => ({
              title: 'Family Varisangya Payment',
              receiptNo: entry.receiptNo || '-',
              payerLabel: 'Family',
              payerName: row.houseName || '-',
              amount: entry.amount,
              paymentDate: entry.paymentDate,
              paymentMethod: entry.paymentMethod || '-',
              remarks: entry.remarks || '',
            }));
            await exportInvoicesToPdf(invoices, filename);
          }
          break;
      }
    } catch (error: any) {
      console.error('Row export error:', error);
      toast.error(error?.message || "Couldn't export family varisangya records");
    } finally {
      setExportingRowId(null);
    }
  };

  const columns: TableColumn<FamilyVarisangyaData>[] = [
    {
      key: 'houseName',
      label: 'House Name',
      render: (name, row) => (
        <Link
          to={ROUTES.FAMILIES.DETAIL(row.id)}
          className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
        >
          {name}
        </Link>
      ),
    },
    { key: 'mahallId', label: 'Mahall ID' },
    {
      key: 'varisangyaCount',
      label: 'Payments',
      render: (count) => count || 0,
    },
    {
      key: 'totalVarisangya',
      label: 'Total Amount',
      render: (amount) => `₹${(amount || 0).toLocaleString()}`,
    },
    {
      key: 'lastPaymentDate',
      label: 'Last Payment',
      render: (date) => (date ? formatDate(date) : '-'),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`${FAMILY_BASE}?view=transactions&familyId=${row.id}`);
            }}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            title="View Transactions"
            aria-label="View Transactions"
          >
            <FiEye className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`${FAMILY_BASE}?view=wallet&familyId=${row.id}`);
            }}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            title="View Wallet"
            aria-label="View Wallet"
          >
            <FiDollarSign className="h-4 w-4" />
          </button>
          <Dropdown
            align="right"
            trigger={
              <button
                onClick={(e) => e.stopPropagation()}
                disabled={exportingRowId === row.id}
                className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors disabled:opacity-50"
                title="Export"
                aria-label="Export"
              >
                {exportingRowId === row.id ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <FiDownload className="h-4 w-4" />
                )}
              </button>
            }
            items={[
              { label: 'Export as CSV', onClick: () => handleExportRow(row, 'csv') },
              { label: 'Export as JSON', onClick: () => handleExportRow(row, 'json') },
              { label: 'Export as PDF', onClick: () => handleExportRow(row, 'pdf') },
            ]}
          />
        </div>
      ),
    },
  ];

  const totalAmount = families.reduce((sum, f) => sum + (f.totalVarisangya || 0), 0);
  const totalPayments = families.reduce((sum, f) => sum + (f.varisangyaCount || 0), 0);
  const stats = [
    {
      title: 'Total Families',
      value: pagination?.total || families.length,
      icon: <FiHome className="h-5 w-5" />,
    },
    { title: 'Total Payments', value: totalPayments, icon: <FiCreditCard className="h-5 w-5" /> },
    {
      title: 'Total Amount',
      value: `₹${totalAmount.toLocaleString()}`,
      icon: <FiDollarSign className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>
      <Card>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
          isFilterVisible={isFilterVisible}
          hasFilters={false}
          onRefresh={fetchFamilies}
          onExport={handleExport}
          isExporting={isExporting}
        />
        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchFamilies} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <Table columns={columns} data={families} emptyMessage="No families found" showExport={false} />
        )}
        {pagination && (
          <div className="mt-4">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={(page) => setCurrentPage(page)}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
