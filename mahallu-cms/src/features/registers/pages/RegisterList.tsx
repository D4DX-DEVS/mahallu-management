import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import FilterBar from '@/components/ui/FilterBar';
import PageHeader from '@/components/ui/PageHeader';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { Pagination as PaginationType } from '@/types';
import { registerService } from '@/services/registerService';
import { useDebounce } from '@/hooks/useDebounce';
import { columnsFor, findRegisterConfig } from '../registerConfigs';
import { getFriendlyError } from '@/utils/apiMessages';

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
  const [itemsPerPage] = useState(10);
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
  }, [key, debouncedSearch, currentPage, filterValues]);

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
      setError(getFriendlyError(err, "Couldn't load register. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  if (!config) {
    return (
      <Card>
        <p className="text-sm text-[#5B6963] dark:text-surface-muted">
          Unknown register.{' '}
          <Link className="text-primary-600 underline" to="/registers">
            Back to registers
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title={config.title} description={config.description} />

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{
            value: searchQuery,
            onChange: (value) => {
              setSearchQuery(value);
              setCurrentPage(1);
            },
            placeholder: 'Search',
          }}
          actions={pagination ? <span className="text-xs font-semibold text-[#7B8983] dark:text-surface-muted">{pagination.total} records</span> : undefined}
        >
          {config.filters &&
            config.filters.length > 0 &&
            config.filters.map((filter) => (
              <div key={filter.name} className="w-40">
                <Select
                  options={filter.options}
                  value={filterValues[filter.name] || ''}
                  onChange={(e) => {
                    setFilterValues((prev) => ({ ...prev, [filter.name]: e.target.value }));
                    setCurrentPage(1);
                  }}
                />
              </div>
            ))}
        </FilterBar>

        <div className="p-3.5">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchRows} className="mt-4" variant="secondary">
              Retry
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No records found"
            description={
              searchQuery || Object.values(filterValues).some((v) => v)
                ? "Try adjusting your search or filters"
                : "No records in this register yet"
            }
            action={
              searchQuery || Object.values(filterValues).some((v) => v)
                ? {
                    label: 'Clear filters',
                    onClick: () => {
                      setSearchQuery('');
                      setFilterValues({});
                      setCurrentPage(1);
                    },
                  }
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table
              columns={columnsFor(config.source)}
              data={rows}
              emptyMessage="No records found"
              showExport={false}
            />
          </div>
        )}

        {pagination && (
          <div className="mt-3.5">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
        </div>
      </Card>
    </div>
  );
}
