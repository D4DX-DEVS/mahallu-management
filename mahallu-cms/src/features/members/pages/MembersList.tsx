import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FiEdit2, FiEye, FiFile, FiFileText, FiPlus, FiUser, FiUserCheck, FiUsers } from 'react-icons/fi';
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
import Dropdown from '@/components/ui/Dropdown';
import ActionsMenu from '@/components/ui/ActionsMenu';
import Avatar from '@/components/ui/Avatar';
import Tabs from '@/components/ui/Tabs';
import StatusBadge from '@/components/ui/StatusBadge';
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
import { logError } from '@/utils/safeLog';

export default function MembersList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'date');
  const [activeTab, setActiveTab] = useState('all');
  const [genderFilter, setGenderFilter] = useState('');
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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
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
  }, [debouncedSearch, sortBy, activeTab, genderFilter, currentPage]);

  useEffect(() => {
    setSelectedIds([]);
  }, [debouncedSearch, sortBy, activeTab, genderFilter, currentPage]);

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
      if (activeTab !== 'all') params.status = activeTab;
      if (genderFilter) params.gender = genderFilter;
      const result = await memberService.getAll(params);
      setMembers(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(loadErrorMessage(err, 'members'));
      logError('Error fetching members', err);
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
      if (activeTab !== 'all') params.status = activeTab;
      if (genderFilter) params.gender = genderFilter;
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
          exportToCSV(exportColumns, dataToExport, filename);
          break;
        case 'pdf':
          await exportToPDF(exportColumns, dataToExport, filename, title);
          break;
      }
    } catch (error: any) {
      logError('Export error', error);
      toast.error(errorMessage(error, { action: 'export data' }));
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<Member>[] = [
    { key: 'mahallId', label: 'Mahall ID', width: '7rem', priority: 'tertiary', render: (id) => <span className="tabular-nums">{id || '-'}</span> },
    {
      key: 'name',
      label: 'Member name',
      width: '14rem',
      sortable: true,
      render: (name, row) => (
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={name} size="md" />
          <div className="min-w-0">
            <div className="truncate font-semibold">{toTitleCase(name)}</div>
            <div className="truncate text-xs text-muted-foreground">{row.phone || 'No phone added'}</div>
          </div>
        </div>
      ),
    },
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
      key: 'status',
      label: 'Status',
      width: '8rem',
      sortable: false,
      render: (status) => <StatusBadge status={status || 'active'} />,
    },
    {
      key: 'actions',
      label: '',
      width: '6.5rem',
      sortable: false,
      align: 'right',
      render: (_, row) => (
        <ActionsMenu
          label={`Actions for ${toTitleCase(row.name)}`}
          items={[
            { label: 'View', icon: <FiEye className="h-4 w-4" />, onClick: () => navigate(ROUTES.MEMBERS.DETAIL(row.id)) },
            { label: 'Edit', icon: <FiEdit2 className="h-4 w-4" />, onClick: () => navigate(ROUTES.MEMBERS.EDIT(row.id)) },
          ]}
        />
      ),
    },
  ];

  // What goes into CSV/PDF: the name column renders an avatar + name + phone block, which the
  // exporter would flatten into "Asha K 9876543210" next to a separate Phone column, and the
  // row-actions column has no data at all. Export plain values and skip the actions column.
  const exportColumns: TableColumn<Member>[] = columns
    .filter((column) => column.key !== 'actions')
    .map((column) => (column.key === 'name' ? { ...column, render: (name: string) => toTitleCase(name) } : column));

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
    <div className="space-y-4">
      <PageHeader
        title="Members"
        description="People registered across all families"
        actions={
          <Link to={ROUTES.MEMBERS.CREATE}>
            <Button icon={<FiPlus />} collapseLabel>New member</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} size="compact" />
        ))}
      </div>

      <TableCard borderless padding="lg">
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchEntity="members"
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={genderFilter ? 1 : 0}
          onRefresh={fetchMembers}
          onExport={handleExport}
          isExporting={isExporting}
          sortOptions={[
            { value: 'date', label: 'Newest first' },
            { value: 'name', label: 'Name' },
            { value: 'mahallId', label: 'Mahall ID' },
          ]}
          sortValue={sortBy}
          onSortChange={(value) => { setSortBy(value); setCurrentPage(1); }}
          tabs={
            <Tabs
              ariaLabel="Member status"
              value={activeTab}
              onChange={(value) => { setActiveTab(value); setCurrentPage(1); }}
              items={[
                { value: 'all', label: 'All', count: pagination?.total },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
          }
        />

          {isFilterVisible && (
            <div className="mt-4">
              <FilterPanel onClose={() => setIsFilterVisible(false)}>
                <div className="w-full sm:w-40">
                  <Select
                    label="Gender"
                    options={[
                      { value: '', label: 'All genders' },
                      { value: 'male', label: 'Male' },
                      { value: 'female', label: 'Female' },
                    ]}
                    value={genderFilter}
                    onChange={(e) => {
                      setGenderFilter(e.target.value);
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
            selectable
            selectedKeys={selectedIds}
            onSelectionChange={setSelectedIds}
            bulkActions={
              <Dropdown
                label="Bulk member actions"
                trigger={<Button variant="outline" size="sm">Export selected</Button>}
                items={[
                  {
                    label: 'Export as CSV',
                    icon: <FiFileText />,
                    onClick: () => exportToCSV(exportColumns, members.filter((member) => selectedIds.includes(member.id)), 'members'),
                  },
                  {
                    label: 'Export as PDF',
                    icon: <FiFile />,
                    onClick: () => void exportToPDF(exportColumns, members.filter((member) => selectedIds.includes(member.id)), 'members', 'Members'),
                  },
                ]}
              />
            }
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
