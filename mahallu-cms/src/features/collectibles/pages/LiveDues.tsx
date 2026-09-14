import { useState, useEffect } from 'react';
import { FiAlertCircle, FiCheckCircle, FiDollarSign, FiHome } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { collectibleService, FamilyDue } from '@/services/collectibleService';
import { fetchAllPages } from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';
import { exportToCSV } from '@/utils/exportUtils';
import { loadErrorMessage, errorMessage } from '@/utils/errors';
import { toast } from '@/store/toastStore';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

export default function LiveDues() {
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyPending, setOnlyPending] = useState(true);
  const [dues, setDues] = useState<FamilyDue[]>([]);
  const [summary, setSummary] = useState<{
    totalFamilies: number;
    familiesWithDues: number;
    totalExpected: number;
    totalPaid: number;
    totalDue: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);
  const [isExporting, setIsExporting] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  // A new search/filter invalidates the current page offset
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, onlyPending]);

  useEffect(() => {
    const fetchDues = async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await collectibleService.getFamilyDues({
          search: debouncedSearch || undefined,
          onlyPending,
          page: currentPage,
          limit: itemsPerPage,
        });
        setDues(result.dues);
        setSummary(result.summary);
        setPagination(result.pagination);
      } catch (err: any) {
        setError(loadErrorMessage(err, 'dues'));
      } finally {
        setLoading(false);
      }
    };
    fetchDues();
  }, [debouncedSearch, onlyPending, currentPage, itemsPerPage]);

  const columns: TableColumn<FamilyDue>[] = [
    // Row number must account for the page offset, not just the index in the slice
    { key: 'familyId', label: 'No.', width: '6rem', render: (_, __, index) => (currentPage - 1) * itemsPerPage + index + 1 },
    { key: 'houseName', label: 'House Name', width: '9.75rem', render: (v) => toTitleCase(v) },
    { key: 'familyHead', label: 'Family Head', width: '9.75rem', render: (v) => (v ? toTitleCase(v) : '-') },
    { key: 'varisangyaGrade', label: 'Grade', width: '6.75rem', render: (v) => (v ? toTitleCase(v) : '-') },
    { key: 'monthlyAmount', label: 'Monthly', width: '7.75rem', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'expectedAmount', label: 'Expected (YTD)', width: '11rem', render: (v) => `₹${(v || 0).toLocaleString()}` },
    { key: 'paidAmount', label: 'Paid', width: '6rem', render: (v) => `₹${(v || 0).toLocaleString()}` },
    {
      key: 'dueAmount',
      label: 'Due',
      width: '7.5rem',
      align: 'center',
      render: (v) =>
        v > 0 ? (
          <span className="font-semibold text-red-600 dark:text-red-400">₹{v.toLocaleString()}</span>
        ) : (
          <span className="font-medium text-green-600 dark:text-green-400">Paid up</span>
        ),
    },
  ];

  const exportColumns: TableColumn<FamilyDue>[] = [
    { key: 'houseName', label: 'House Name', width: '9.75rem' },
    { key: 'familyHead', label: 'Family Head', width: '9.75rem' },
    { key: 'varisangyaGrade', label: 'Grade', width: '6.75rem' },
    { key: 'monthlyAmount', label: 'Monthly', width: '7.75rem' },
    { key: 'expectedAmount', label: 'Expected (YTD)', width: '11rem' },
    { key: 'paidAmount', label: 'Paid', width: '6rem' },
    { key: 'dueAmount', label: 'Due', width: '6rem' },
  ];

  // Export covers every matching row, not just the page on screen
  const handleExport = async (_type?: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      // The endpoint caps limit at 100 and 400s above it, so a single
      // limit:10000 request always failed - page through instead.
      const dues = await fetchAllPages<FamilyDue>(async (p) => {
        const page = await collectibleService.getFamilyDues({
          search: debouncedSearch || undefined,
          onlyPending,
          ...p,
        });
        return { data: page.dues, pagination: page.pagination };
      });
      if (dues.length === 0) {
        toast.info('Nothing to export');
        return;
      }
      exportToCSV(exportColumns, dues, 'varisangya-dues');
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'export this list' }));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <PageHeader title="Live Dues" description="Varisangya expected vs paid for the current year" />
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="Families" value={summary.totalFamilies} icon={<FiHome className="h-5 w-5" />} />
          <StatCard
            title="With Dues"
            value={summary.familiesWithDues}
            icon={<FiAlertCircle className="h-5 w-5" />}
          />
          <StatCard
            title="Total Collected"
            value={`₹${summary.totalPaid.toLocaleString()}`}
            icon={<FiCheckCircle className="h-5 w-5" />}
          />
          <StatCard
            title="Total Due"
            value={`₹${summary.totalDue.toLocaleString()}`}
            icon={<FiDollarSign className="h-5 w-5" />}
          />
        </div>
      )}

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onExport={handleExport}
          isExporting={isExporting}
        />

        <div className="mb-4 flex items-center gap-2 px-1">
          <input
            aria-label="Select row"
            id="only-pending"
            type="checkbox"
            checked={onlyPending}
            onChange={(e) => setOnlyPending(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <label htmlFor="only-pending" className="text-sm text-gray-600 dark:text-gray-300">
            Show only families with pending dues
          </label>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-200">
            {error}
          </div>
        )}

        <Table
          fixedLayout
          striped
          columns={columns}
          data={dues}
          isLoading={loading}
          emptyMessage="No dues found"
          showExport={false}
        />
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-4">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(items) => {
                setItemsPerPage(items);
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </TableCard>
    </div>
  );
}
