import { useState, useEffect, useCallback } from 'react';
import { FiAlertCircle, FiCheckCircle, FiDollarSign, FiHome } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import FilterPanel from '@/components/ui/FilterPanel';
import Checkbox from '@/components/ui/Checkbox';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
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
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [isExporting, setIsExporting] = useState(false);
  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  // A new search/filter invalidates the current page offset
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, onlyPending]);

  const fetchDues = useCallback(async () => {
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
  }, [debouncedSearch, onlyPending, currentPage, itemsPerPage]);

  useEffect(() => {
    fetchDues();
  }, [fetchDues]);

  const columns: TableColumn<FamilyDue>[] = [
    // Row number must account for the page offset, not just the index in the slice
    { key: 'familyId', label: 'No.', width: '5rem', sortable: false, priority: 'secondary', render: (_, __, index) => (currentPage - 1) * itemsPerPage + index + 1 },
    { key: 'houseName', label: 'House name', sortable: true, width: '14rem', render: (v) => <span className="font-medium text-foreground">{toTitleCase(v)}</span> },
    { key: 'familyHead', label: 'Family head', sortable: true, width: '12rem', render: (v) => (v ? toTitleCase(v) : '—') },
    { key: 'varisangyaGrade', label: 'Grade', sortable: true, priority: 'secondary', width: '8rem', render: (v) => (v ? toTitleCase(v) : '—') },
    { key: 'monthlyAmount', label: 'Monthly', align: 'right', sortable: true, priority: 'tertiary', width: '8rem', render: (v) => `₹${(v || 0).toLocaleString('en-IN')}` },
    { key: 'expectedAmount', label: 'Expected (YTD)', align: 'right', sortable: true, priority: 'secondary', width: '10rem', render: (v) => `₹${(v || 0).toLocaleString('en-IN')}` },
    { key: 'paidAmount', label: 'Paid', align: 'right', sortable: true, width: '8rem', render: (v) => `₹${(v || 0).toLocaleString('en-IN')}` },
    {
      key: 'dueAmount',
      label: 'Due',
      width: '8rem',
      align: 'right',
      sortable: true,
      render: (v) =>
        v > 0 ? (
          <span className="font-semibold text-destructive">₹{v.toLocaleString('en-IN')}</span>
        ) : (
          <span className="font-medium text-success">Paid up</span>
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

  const isFiltered = Boolean(debouncedSearch) || onlyPending;

  return (
    <>
      <PageHeader title="Live dues" description="Varisangya expected vs paid for the current year." />

      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="Families" value={summary.totalFamilies} icon={<FiHome className="h-5 w-5" />} />
          <StatCard
            title="With dues"
            value={summary.familiesWithDues}
            icon={<FiAlertCircle className="h-5 w-5" />}
          />
          <StatCard
            title="Total collected"
            value={`₹${summary.totalPaid.toLocaleString('en-IN')}`}
            icon={<FiCheckCircle className="h-5 w-5" />}
          />
          <StatCard
            title="Total due"
            value={`₹${summary.totalDue.toLocaleString('en-IN')}`}
            icon={<FiDollarSign className="h-5 w-5" />}
          />
        </div>
      )}

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchEntity="families"
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={onlyPending ? 1 : 0}
          onRefresh={fetchDues}
          onExport={handleExport}
          isExporting={isExporting}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} />
              Show only families with pending dues
            </label>
            {onlyPending && (
              <Button variant="ghost" onClick={() => setOnlyPending(false)}>
                Clear filters
              </Button>
            )}
          </FilterPanel>
        )}

        {error ? (
          <EmptyState variant="error" entity="dues" description={error} action={{ label: 'Try again', onClick: fetchDues }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={dues}
              isLoading={loading}
              entity="families"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); setOnlyPending(false); } }
                  : undefined
              }
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="families"
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(items) => {
                    setItemsPerPage(items);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
          </>
        )}
      </TableCard>
    </>
  );
}
