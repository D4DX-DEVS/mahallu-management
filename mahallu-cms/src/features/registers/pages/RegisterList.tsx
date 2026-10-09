import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Card from '@/components/ui/Card';
import TableCard from '@/components/ui/TableCard';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import FilterPanel from '@/components/ui/FilterPanel';
import TableToolbar from '@/components/ui/TableToolbar';
import Button from '@/components/ui/Button';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { Pagination as PaginationType } from '@/types';
import { registerService } from '@/services/registerService';
import { useDebounce } from '@/hooks/useDebounce';
import { columnsFor, findRegisterConfig } from '../registerConfigs';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

/**
 * One page serves every community register - the config carries title,
 * endpoint key and columns, so a new register needs no new page.
 */
export default function RegisterList() {
  const { key } = useParams<{ key: string }>();
  const config = findRegisterConfig(key);

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    setCurrentPage(1);
    setFilterValues({});
    setSearchQuery('');
  }, [key]);

  useEffect(() => {
    if (config) fetchRows();
  }, [key, debouncedSearch, currentPage, itemsPerPage, filterValues]);

  const fetchRows = async () => {
    if (!config) return;
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = { page: currentPage, limit: itemsPerPage };
      if (debouncedSearch) params.search = debouncedSearch;
      Object.entries(filterValues).forEach(([name, value]) => {
        if (value) params[name] = value;
      });
      const result = await registerService.getRegister(config.key, params);
      setRows(result.data);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'register'));
    } finally {
      setLoading(false);
    }
  };

  if (!config) {
    return (
      <Card>
        {/* JSX collapses the newline between the sentence and the link, so this
            used to render as "Unknown register.Back to registers". */}
        <p className="text-sm text-muted-foreground">
          That register doesn&rsquo;t exist. It may have been renamed or removed.{' '}
          <Link className="rounded-sm text-primary underline" to="/registers">
            Back to registers
          </Link>
        </p>
      </Card>
    );
  }

  const activeFilterCount = Object.values(filterValues).filter(Boolean).length;
  const isFiltered = Boolean(debouncedSearch) || activeFilterCount > 0;
  const hasFilters = Boolean(config.filters && config.filters.length > 0);
  const clearFilters = () => {
    setSearchQuery('');
    setFilterValues({});
    setCurrentPage(1);
  };

  return (
    <>
      <PageHeader title={config.title} description={config.description} />

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={(value) => {
            setSearchQuery(value);
            setCurrentPage(1);
          }}
          searchEntity="records"
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters={hasFilters}
          activeFilterCount={activeFilterCount}
          onRefresh={fetchRows}
        />

        {hasFilters && isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            {config.filters!.map((filter) => (
              <div key={filter.name} className="w-full sm:w-52">
                <Select
                  label={filter.label}
                  options={filter.options}
                  value={filterValues[filter.name] || ''}
                  onChange={(e) => {
                    setFilterValues((prev) => ({ ...prev, [filter.name]: e.target.value }));
                    setCurrentPage(1);
                  }}
                />
              </div>
            ))}
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                onClick={() => {
                  setFilterValues({});
                  setCurrentPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterPanel>
        )}

        {error ? (
          <EmptyState variant="error" entity="records" description={error} action={{ label: 'Try again', onClick: fetchRows }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columnsFor(config.source)}
              data={rows}
              isLoading={loading}
              entity="records"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={isFiltered ? { label: 'Clear filters', onClick: clearFilters } : undefined}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="records"
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
