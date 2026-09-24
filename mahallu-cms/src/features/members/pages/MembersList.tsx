import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FiEdit2, FiEye, FiPlus, FiUser, FiUserCheck, FiUsers } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import FilterPanel from '@/components/ui/FilterPanel';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { Member } from '@/types';
import { memberService } from '@/services/memberService';
import { familyService } from '@/services/familyService';
import { fetchAllPages } from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';
import { ROUTES } from '@/constants/routes';
import { exportToCSV, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';
import PageHeader from '@/components/layout/PageHeader';
import ActionsMenu from '@/components/ui/ActionsMenu';

export default function MembersList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [isFilterVisible, setIsFilterVisible] = useState(!!searchParams.get('sort'));
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'date');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(() => {
    const page = Number(searchParams.get('page'));
    return page > 0 ? page : 1;
  });
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [memberStats, setMemberStats] = useState({ totalMembers: 0, maleCount: 0, femaleCount: 0 });

  const debouncedSearch = useDebounce(searchQuery, 500);

  // A new search term invalidates the current page offset: searching from page 4
  // kept asking the API for page 4 of the new, much shorter result set and showed
  // an empty table. Skipped on the mount that restores a page from the URL.
  const skipPageReset = useRef(true);
  useEffect(() => {
    if (skipPageReset.current) {
      skipPageReset.current = false;
      return;
    }
    setCurrentPage(1);
  }, [debouncedSearch]);

  // Keep the URL in sync so a searched/sorted/paged list survives navigating to
  // a detail page and back, and survives a refresh.
  useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedSearch) next.set('q', debouncedSearch);
    if (sortBy && sortBy !== 'date') next.set('sort', sortBy);
    if (currentPage > 1) next.set('page', String(currentPage));
    setSearchParams(next, { replace: true });
  }, [debouncedSearch, sortBy, currentPage, setSearchParams]);

  useEffect(() => {
    fetchMembers();
  }, [debouncedSearch, sortBy, currentPage]);

  useEffect(() => {
    familyService
      .getStats()
      .then((stats) => stats && setMemberStats(stats))
      .catch(() => undefined);
  }, []);

  const fetchMembers = async () => {
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
      if (sortBy && sortBy !== 'date') {
        params.sortBy = sortBy;
      }
      const result = await memberService.getAll(params);
      setMembers(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(loadErrorMessage(err, 'members'));
      console.error('Error fetching members:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'pdf') => {
    try {
      setIsExporting(true);
      const params: any = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (sortBy && sortBy !== 'date') params.sortBy = sortBy;
      const dataToExport = await fetchAllPages((pageParams) =>
        memberService.getAll({ ...params, ...pageParams })
      );
      if (dataToExport.length === 0) {
        toast.info('No members to export');
        return;
      }
      const filename = 'members';
      const title = 'All Members';
      switch (type) {
        case 'csv':
          exportToCSV(columns, dataToExport, filename);
          break;
        case 'pdf':
          exportToPDF(columns, dataToExport, filename, title);
          break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(errorMessage(error, { action: 'export data' }));
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<Member>[] = [
    { key: 'mahallId', label: 'Mahall ID', width: '7rem', priority: 'secondary', render: (id) => <span className="tabular-nums">{id || '-'}</span> },
    { key: 'name', label: 'Name', width: '9.5rem', sortable: true, render: (name) => <span className="font-medium">{toTitleCase(name)}</span> },
    { key: 'familyName', label: 'Family', width: '9rem', priority: 'secondary', render: (name) => toTitleCase(name) },
    {
      key: 'age',
      label: 'Age',
      width: '5.5rem',
      align: 'center',
      render: (_, row) => <span className="tabular-nums">{row.age ?? '-'}</span>,
    },
    { key: 'phone', label: 'Phone', width: '7.5rem', priority: 'secondary', render: (phone) => <span className="tabular-nums">{phone || '-'}</span> },
    { key: 'education', label: 'Education', width: '8rem', priority: 'tertiary', render: (edu) => edu || '-' },
    {
      key: 'actions',
      label: '',
      width: '6.5rem',
      sortable: false,
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigate(ROUTES.MEMBERS.EDIT(row.id));
            }}
            aria-label={`Edit ${toTitleCase(row.name)}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <FiEdit2 className="h-4 w-4" aria-hidden="true" />
          </button>
          <ActionsMenu
            label={`Actions for ${toTitleCase(row.name)}`}
            items={[
              { label: 'View', icon: <FiEye className="h-4 w-4" />, onClick: () => navigate(ROUTES.MEMBERS.DETAIL(row.id)) },
              { label: 'Edit', icon: <FiEdit2 className="h-4 w-4" />, onClick: () => navigate(ROUTES.MEMBERS.EDIT(row.id)) },
            ]}
          />
        </div>
      ),
    },
  ];

  const stats = [
    {
      title: 'Total Family Members',
      value: memberStats.totalMembers || pagination?.total || members.length,
      icon: <FiUsers className="h-5 w-5" />,
    },
    {
      title: 'Total Males',
      value: memberStats.maleCount,
      icon: <FiUser className="h-5 w-5" />,
    },
    {
      title: 'Total Females',
      value: memberStats.femaleCount,
      icon: <FiUserCheck className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Members"
        description="People registered across all families"
        actions={
          <Link to={ROUTES.MEMBERS.CREATE}>
            <Button icon={<FiPlus />} collapseLabel>New member</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} size="compact" />
        ))}
      </div>

      <TableCard padding="lg">
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchEntity="members"
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
          isFilterVisible={isFilterVisible}
          hasFilters
          onRefresh={fetchMembers}
          onExport={handleExport}
          isExporting={isExporting}
        />

          {isFilterVisible && (
            <div className="mt-4">
              <FilterPanel onClose={() => setIsFilterVisible(false)}>
                <div className="w-full sm:w-40">
                  <Select
                    options={[
                      { value: 'date', label: 'Date' },
                      { value: 'mahallId', label: 'Mahall ID' },
                      { value: 'name', label: 'Name' },
                    ]}
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>
              </FilterPanel>
            </div>
          )}

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <EmptyState
            variant="error"
            entity="members"
            description={error}
            action={{ label: 'Retry', onClick: fetchMembers }}
          />
        ) : (
          <Table
            fixedLayout
            striped
            columns={columns}
            data={members}
            entity="members"
            emptyMessage="No Members Yet"
            emptyAction={{ label: 'Add member', onClick: () => navigate(ROUTES.MEMBERS.CREATE) }}
            onRowClick={(row) => navigate(ROUTES.MEMBERS.DETAIL(row.id))}
          />
        )}

        {/* Pagination */}
        {pagination && (
          <div className="mt-4">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={(page) => {
                setCurrentPage(page);
              }}
            />
          </div>
        )}
      </TableCard>
    </div>
  );
}
