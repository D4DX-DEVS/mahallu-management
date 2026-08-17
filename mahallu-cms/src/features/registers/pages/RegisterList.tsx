import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import SearchInput from '@/components/ui/SearchInput';
import { PageSkeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { Pagination as PaginationType } from '@/types';
import { registerService } from '@/services/registerService';
import { useDebounce } from '@/hooks/useDebounce';
import { columnsFor, findRegisterConfig } from '../registerConfigs';

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
      setError(err.response?.data?.message || 'Failed to load register');
    } finally {
      setLoading(false);
    }
  };

  if (!config) {
    return (
      <Card>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Unknown register.{' '}
          <Link className="text-primary-600 underline" to="/registers">
            Back to registers
          </Link>
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{config.title}</h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{config.description}</p>
        </div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Registers', path: '/registers' },
            { label: config.title },
          ]}
        />
      </div>

      <Card>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="w-full sm:max-w-xs">
            <SearchInput
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search..."
            />
          </div>

          {config.filters && config.filters.length > 0 && (
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              {config.filters.map((filter) => (
                <Select
                  key={filter.name}
                  options={filter.options}
                  value={filterValues[filter.name] || ''}
                  onChange={(e) => {
                    setFilterValues((prev) => ({ ...prev, [filter.name]: e.target.value }));
                    setCurrentPage(1);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {pagination && (
          <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{pagination.total} records</p>
        )}

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchRows} className="mt-4" variant="outline">
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
          <div className="mt-4">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </Card>
    </div>
  );
}
