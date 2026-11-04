import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import FilterPanel from '@/components/ui/FilterPanel';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/layout/PageHeader';
import { getCounsellingCases, ICounsellingCase } from '@/services/counsellingService';
import { TableColumn } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';
import { loadErrorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';

const CATEGORIES = ['marriage', 'family', 'adolescent', 'education', 'parenting', 'behaviour', 'career'];
const STATUSES = ['open', 'in_progress', 'follow_up', 'closed'];

export default function CounsellingList() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<ICounsellingCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  const debouncedSearch = useDebounce(searchQuery, 500);
  const activeFilterCount = (selectedCategory ? 1 : 0) + (selectedStatus ? 1 : 0);
  const isFiltered = Boolean(debouncedSearch) || activeFilterCount > 0;

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getCounsellingCases(currentPage, itemsPerPage, selectedCategory, selectedStatus, debouncedSearch);
      setCases(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
      setAccessDenied(false);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setAccessDenied(true);
        setCases([]);
      } else {
        setError(loadErrorMessage(err, 'counselling cases'));
      }
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, selectedCategory, selectedStatus, debouncedSearch]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const clearFilters = () => {
    setSelectedCategory('');
    setSelectedStatus('');
    setCurrentPage(1);
  };

  const columns: TableColumn<ICounsellingCase>[] = [
    { key: 'caseNo', label: 'Case no.', sortable: true, width: '10rem', render: (v) => <span className="font-medium text-foreground">{v}</span> },
    { key: 'category', label: 'Category', sortable: true, width: '9rem', render: (v) => (v ? toTitleCase(v) : '—') },
    { key: 'counsellorName', label: 'Counsellor', sortable: true, priority: 'secondary', width: '12rem', render: (v) => (v ? toTitleCase(v) : '—') },
    {
      key: 'clientName',
      label: 'Client',
      sortable: false,
      priority: 'secondary',
      width: '12rem',
      render: (_v, row) => (row.clientName ? toTitleCase(row.clientName) : row.clientMemberId ? 'Member record' : 'Anonymous'),
    },
    { key: 'appointmentDate', label: 'Appointment', sortable: true, width: '9rem', render: (v) => (v ? new Date(v).toLocaleDateString() : '—') },
    { key: 'status', label: 'Status', sortable: true, width: '9rem', render: (v) => <StatusBadge status={v} /> },
  ];

  if (accessDenied) {
    return (
      <>
        <PageHeader title="Counselling cases" description="Confidential counselling sessions and follow-ups." />
        <EmptyState
          variant="no-access"
          title="You need permission to view this"
          description="Access to counselling cases requires special permission. Please contact your administrator to request access."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Counselling cases"
        description="Confidential counselling sessions and follow-ups."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => navigate('/counselling/create')}>
            New case
          </Button>
        }
      />

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={(value) => {
            setSearchQuery(value);
            setCurrentPage(1);
          }}
          searchEntity="cases"
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={activeFilterCount}
          onRefresh={fetchCases}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-52">
              <Select
                label="Category"
                options={[{ value: '', label: 'All categories' }, ...CATEGORIES.map((value) => ({ value, label: toTitleCase(value.replace(/_/g, ' ')) }))]}
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="w-full sm:w-52">
              <Select
                label="Status"
                options={[{ value: '', label: 'All statuses' }, ...STATUSES.map((value) => ({ value, label: toTitleCase(value.replace(/_/g, ' ')) }))]}
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </FilterPanel>
        )}

        {error ? (
          <EmptyState variant="error" entity="counselling cases" description={error} action={{ label: 'Try again', onClick: fetchCases }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={cases}
              isLoading={loading}
              entity="counselling cases"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); clearFilters(); } }
                  : { label: 'Add case', onClick: () => navigate('/counselling/create') }
              }
              onRowClick={(row) => navigate(`/counselling/${row.id}`)}
            />

            <div className="mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                entity="cases"
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(size) => {
                  setItemsPerPage(size);
                  setCurrentPage(1);
                }}
              />
            </div>
          </>
        )}
      </TableCard>
    </>
  );
}
