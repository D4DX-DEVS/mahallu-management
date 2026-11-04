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
import { getDisputeCases, IDisputeCase } from '@/services/counsellingService';
import { TableColumn } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';
import { loadErrorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';

const TYPES = ['family', 'marriage', 'divorce', 'community', 'inheritance', 'other'];
const STATUSES = ['registered', 'mediation', 'resolved', 'referred', 'closed'];

export default function DisputesList() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<IDisputeCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');

  const debouncedSearch = useDebounce(searchQuery, 500);
  const activeFilterCount = (selectedType ? 1 : 0) + (selectedStatus ? 1 : 0);
  const isFiltered = Boolean(debouncedSearch) || activeFilterCount > 0;

  const fetchCases = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getDisputeCases(currentPage, itemsPerPage, selectedType, selectedStatus, debouncedSearch);
      setCases(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
      setAccessDenied(false);
    } catch (err: any) {
      if (err.response?.status === 403) {
        setAccessDenied(true);
        setCases([]);
      } else {
        setError(loadErrorMessage(err, 'dispute cases'));
      }
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, selectedType, selectedStatus, debouncedSearch]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const clearFilters = () => {
    setSelectedType('');
    setSelectedStatus('');
    setCurrentPage(1);
  };

  const columns: TableColumn<IDisputeCase>[] = [
    { key: 'caseNo', label: 'Case no.', sortable: true, width: '10rem', render: (v) => <span className="font-medium text-foreground">{v}</span> },
    { key: 'type', label: 'Type', sortable: true, width: '9rem', render: (v) => (v ? toTitleCase(v) : '—') },
    {
      key: 'parties',
      label: 'Parties',
      sortable: false,
      width: '16rem',
      render: (v) => ((v ?? []) as string[]).map((party) => toTitleCase(party)).join(', ') || '—',
    },
    {
      key: 'mediators',
      label: 'Mediators',
      sortable: false,
      priority: 'secondary',
      width: '14rem',
      render: (v) => ((v ?? []) as string[]).map((mediator) => toTitleCase(mediator)).join(', ') || '—',
    },
    { key: 'status', label: 'Status', sortable: true, width: '9rem', render: (v) => <StatusBadge status={v} /> },
  ];

  if (accessDenied) {
    return (
      <>
        <PageHeader title="Maslahat (disputes)" description="Mediation of family and community disputes." />
        <EmptyState
          variant="no-access"
          title="You need permission to view this"
          description="Access to dispute cases requires special permission. Please contact your administrator to request access."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Maslahat (disputes)"
        description="Mediation of family and community disputes."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => navigate('/maslahat/create')}>
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
                label="Type"
                options={[{ value: '', label: 'All types' }, ...TYPES.map((value) => ({ value, label: toTitleCase(value.replace(/_/g, ' ')) }))]}
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
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
          <EmptyState variant="error" entity="dispute cases" description={error} action={{ label: 'Try again', onClick: fetchCases }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={cases}
              isLoading={loading}
              entity="dispute cases"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); clearFilters(); } }
                  : { label: 'Add case', onClick: () => navigate('/maslahat/create') }
              }
              onRowClick={(row) => navigate(`/maslahat/${row.id}`)}
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
