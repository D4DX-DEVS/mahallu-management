import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiDollarSign, FiHome, FiCreditCard, FiDownload, FiRefreshCw, FiFileText, FiFile } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import Dropdown, { DropdownItem } from '@/components/ui/Dropdown';
import FilterBar from '@/components/ui/FilterBar';
import { TableColumn, Pagination as PaginationType, Family } from '@/types';
import { familyService } from '@/services/familyService';
import { collectibleService } from '@/services/collectibleService';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/format';
import { ROUTES } from '@/constants/routes';
import { exportToCSV, exportToJSON } from '@/utils/exportUtils';
import { exportInvoicesToPdf, InvoiceDetails } from '@/utils/invoiceUtils';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

interface FamilyVarisangyaData extends Family {
  totalVarisangya?: number;
  varisangyaCount?: number;
  lastPaymentDate?: string;
}

const FAMILY_BASE = ROUTES.COLLECTIBLES.FAMILY_VARISANGYA.BASE;

export default function FamilyVarisangyaList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
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

      const getFamilyId = (v: any) => (typeof v.familyId === 'object' && v.familyId != null ? (v.familyId as any).id : v.familyId);
      const familiesWithVarisangya = familiesData.map((family) => {
        const fid = (family as any).id ?? (family as any)._id;
        const familyVarisangyas = allVarisangyas.filter(
          (v) => getFamilyId(v) === fid
        );
        const totalVarisangya = familyVarisangyas.reduce(
          (sum, v) => sum + (v.amount || 0),
          0
        );
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
      setError(getFriendlyError(err, "Couldn't load families. Refresh the page or try again."));
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
        const familyVarisangyas = allVarisangyas.filter(
          (v) => v.familyId === family.id
        );
        const totalVarisangya = familyVarisangyas.reduce(
          (sum, v) => sum + (v.amount || 0),
          0
        );
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
        toast.info('Nothing to export. Change your filters and try again.');
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
              const familyVarisangyas = allVarisangyas.filter(
                (v) => v.familyId === family.id
              );
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
            await exportInvoicesToPdf(invoices, `family-varisangya-invoices-${new Date().toISOString().split('T')[0]}`);
          }
          break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(getFriendlyError(error, "Couldn't export family varisangya data. Check your connection and try again."));
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
      toast.error(getFriendlyError(error, "Couldn't export family varisangya records. Check your connection and try again."));
    } finally {
      setExportingRowId(null);
    }
  };

  const columns: TableColumn<FamilyVarisangyaData>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    {
      key: 'houseName',
      label: 'House Name',
      render: (name, row) => (
        <Link to={ROUTES.FAMILIES.DETAIL(row.id)} className="text-primary-600 hover:text-primary-700 dark:text-primary-400">
          <PersonCell name={name} />
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
      hideable: false,
      render: (_, row) => {
        const busy = exportingRowId === row.id ? 'Exporting...' : undefined;
        return (
          <RowActions
            onView={() => navigate(`${FAMILY_BASE}?view=transactions&familyId=${row.id}`)}
            viewLabel="View transactions"
            extra={[
              { label: 'View wallet', icon: <FiDollarSign />, onClick: () => navigate(`${FAMILY_BASE}?view=wallet&familyId=${row.id}`) },
              { label: 'Export as CSV', icon: <FiDownload />, onClick: () => handleExportRow(row, 'csv'), disabledReason: busy },
              { label: 'Export as JSON', icon: <FiFile />, onClick: () => handleExportRow(row, 'json'), disabledReason: busy },
              { label: 'Export as PDF', icon: <FiFileText />, onClick: () => handleExportRow(row, 'pdf'), disabledReason: busy },
            ]}
          />
        );
      },
    },
  ];

  const totalAmount = families.reduce((sum, f) => sum + (f.totalVarisangya || 0), 0);
  const totalPayments = families.reduce((sum, f) => sum + (f.varisangyaCount || 0), 0);
  const stats = [
    { title: 'Total Families', value: pagination?.total || families.length, icon: <FiHome className="h-[17px] w-[17px]" /> },
    { title: 'Total Payments', value: totalPayments, icon: <FiCreditCard className="h-[17px] w-[17px]" /> },
    { title: 'Total Amount', value: `₹${totalAmount.toLocaleString()}`, icon: <FiDollarSign className="h-[17px] w-[17px]" />, tone: 'lime' as const, viz: families.filter((r) => (r.totalVarisangya || 0) > 0).length >= 2 ? { type: 'ladder' as const, values: families.map((r) => r.totalVarisangya || 0) } : undefined, summary: `Total amount ₹${totalAmount.toLocaleString()}, top contributors ranked` },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard key={index} variant="inline" {...stat} />
        ))}
      </div>
      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search families' }}
          actions={
            <>
              <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={fetchFamilies}>
                <FiRefreshCw className="h-3.5 w-3.5" />
              </Button>
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
        />

        <div className="p-3.5">
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchFamilies} className="mt-4" variant="secondary">
              Retry
            </Button>
          </div>
        ) : (
          <Table columns={columns} data={families} emptyMessage="No families found" showExport={false} />
        )}
        {pagination && (
          <div className="mt-3.5">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={(page) => setCurrentPage(page)}
            />
          </div>
        )}
        </div>
      </Card>
    </div>
  );
}
