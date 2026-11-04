import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import FilterPanel from '@/components/ui/FilterPanel';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import StatusBadge from '@/components/ui/StatusBadge';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import { Pagination as PaginationType, TableColumn } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';
import {
  madrasaService,
  MadrasaClass,
  MadrasaSummary,
  CLASS_TYPE_OPTIONS,
  classTypeLabel,
  teacherName,
} from '@/services/madrasaService';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

const TYPE_FILTER = [{ value: '', label: 'All types' }, ...CLASS_TYPE_OPTIONS];
const STATUS_FILTER = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export default function ClassesList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<MadrasaClass[]>([]);
  const [summary, setSummary] = useState<MadrasaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 500);
  const activeFilterCount = (typeFilter ? 1 : 0) + (statusFilter ? 1 : 0);
  const isFiltered = Boolean(debouncedSearch) || activeFilterCount > 0;

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = { page: currentPage, limit: itemsPerPage };
      if (typeFilter) params.classType = typeFilter;
      if (statusFilter) params.status = statusFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const result = await madrasaService.getClasses(params);
      setRows(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError(loadErrorMessage(err, 'classes'));
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter, debouncedSearch, currentPage, itemsPerPage]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    madrasaService
      .getSummary()
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  const clearFilters = () => {
    setTypeFilter('');
    setStatusFilter('');
    setCurrentPage(1);
  };

  const columns: TableColumn<MadrasaClass>[] = [
    {
      key: 'name',
      label: 'Class',
      sortable: true,
      width: '16rem',
      render: (name, cls) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{toTitleCase(name)}</div>
          {cls.nameMl && <div className="truncate text-xs text-muted-foreground">{cls.nameMl}</div>}
        </div>
      ),
    },
    { key: 'classType', label: 'Type', sortable: true, priority: 'secondary', width: '10rem', render: (v) => classTypeLabel(v) },
    { key: 'teacher', label: 'Teacher', sortable: false, priority: 'secondary', width: '12rem', render: (_v, cls) => toTitleCase(teacherName(cls)) },
    { key: 'academicYear', label: 'Year', sortable: true, width: '8rem' },
    { key: 'studentCount', label: 'Students', align: 'center', sortable: true, width: '8rem', render: (v) => <span className="tabular-nums">{v ?? 0}</span> },
    { key: 'status', label: 'Status', sortable: true, width: '8rem', render: (v) => <StatusBadge status={v || 'active'} /> },
  ];

  return (
    <>
      <PageHeader
        title="Education"
        description="Madrasa classes and the students enrolled in them."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => navigate('/education/classes/create')}>
            New class
          </Button>
        }
      />

      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="Classes" value={summary.totalClasses} />
          <StatCard title="Active students" value={summary.activeStudents} />
          <StatCard title="Completed" value={summary.completedStudents} />
          <StatCard title="Dropped" value={summary.droppedStudents} />
        </div>
      )}

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={(value) => {
            setSearchQuery(value);
            setCurrentPage(1);
          }}
          searchEntity="classes"
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={activeFilterCount}
          onRefresh={fetchRows}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-52">
              <Select
                label="Type"
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                options={TYPE_FILTER}
              />
            </div>
            <div className="w-full sm:w-52">
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                options={STATUS_FILTER}
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
          <EmptyState variant="error" entity="classes" description={error} action={{ label: 'Try again', onClick: fetchRows }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={rows}
              isLoading={loading}
              entity="classes"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); clearFilters(); } }
                  : { label: 'Add class', onClick: () => navigate('/education/classes/create') }
              }
              onRowClick={(cls) => navigate(`/education/classes/${cls.id}`)}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="classes"
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
    </>
  );
}
