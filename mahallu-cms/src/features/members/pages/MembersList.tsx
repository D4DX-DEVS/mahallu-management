import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiDownload, FiFile, FiFileText, FiMoreHorizontal, FiPlus } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import FilterPanel from '@/components/ui/FilterPanel';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import Dropdown, { DropdownItem } from '@/components/ui/Dropdown';
import Avatar from '@/components/ui/Avatar';
import Tabs from '@/components/ui/Tabs';
import StatusBadge from '@/components/ui/StatusBadge';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { Member } from '@/types';
import { memberService } from '@/services/memberService';
import { fetchAllPages } from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';
import { ROUTES } from '@/constants/routes';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';
import PageHeader from '@/components/layout/PageHeader';

export default function MembersList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [activeTab, setActiveTab] = useState('all');
  const [genderFilter, setGenderFilter] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchMembers();
  }, [debouncedSearch, sortBy, activeTab, genderFilter, currentPage]);

  useEffect(() => {
    setSelectedIds([]);
  }, [debouncedSearch, sortBy, activeTab, genderFilter, currentPage]);

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
      console.error('Error fetching members:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
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
          exportToCSV(columns, dataToExport, filename);
          break;
        case 'json':
          exportToJSON(columns, dataToExport, filename);
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
    { key: 'mahallId', label: 'Mahall ID', width: '8.75rem', priority: 'tertiary', render: (id) => id || '-' },
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
    { key: 'familyName', label: 'Family Name', width: '10rem', render: (name) => toTitleCase(name) },
    {
      key: 'age',
      label: 'Age / Gender',
      width: '12rem',
      align: 'center',
      render: (_, row) => {
        const age = row.age ? `${row.age}` : '-';
        const gender = row.gender || '-';
        return `${age} / ${gender}`;
      },
    },
    { key: 'phone', label: 'Phone', width: '6.75rem', priority: 'secondary', render: (phone) => phone || '-' },
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
      width: '3.5rem',
      sortable: false,
      render: (_, row) => {
        const items: DropdownItem[] = [
          { label: 'View member', onClick: () => navigate(ROUTES.MEMBERS.DETAIL(row.id)) },
          { label: 'Edit member', onClick: () => navigate(`/members/${row.id}/edit`) },
        ];
        return (
          <Dropdown
            label={`Actions for ${row.name}`}
            items={items}
            trigger={
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.name}`}>
                <FiMoreHorizontal className="h-4 w-4" />
              </Button>
            }
          />
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Members"
        description="Manage the people registered in this mahallu."
        actions={
          <>
            <Dropdown
              label="Export members"
              trigger={<Button variant="outline" isLoading={isExporting} loadingText="Exporting" icon={<FiDownload />} collapseLabel>Export</Button>}
              items={[
                { label: 'Export as CSV', icon: <FiFileText />, onClick: () => handleExport('csv') },
                { label: 'Export as PDF', icon: <FiFile />, onClick: () => handleExport('pdf') },
              ]}
            />
            <Link to={ROUTES.MEMBERS.CREATE}>
              <Button icon={<FiPlus />} collapseLabel>Invite member</Button>
            </Link>
          </>
        }
      />

      {/* Actions and Filters */}
      <TableCard borderless>
        <div className="flex flex-col gap-4 mb-4">
          <TableToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            searchEntity="members"
            onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
            isFilterVisible={isFilterVisible}
            hasFilters={true}
            activeFilterCount={genderFilter ? 1 : 0}
            onRefresh={fetchMembers}
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
          )}
        </div>

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchMembers} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <Table
            fixedLayout
            striped
            columns={columns}
            data={members}
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
                    onClick: () => exportToCSV(columns, members.filter((member) => selectedIds.includes(member.id)), 'members'),
                  },
                  {
                    label: 'Export as PDF',
                    icon: <FiFile />,
                    onClick: () => exportToPDF(columns, members.filter((member) => selectedIds.includes(member.id)), 'members', 'Members'),
                  },
                ]}
              />
            }
            emptyMessage="No Members Yet"
            exportFilename="members"
            exportTitle="All Family Members"
            showExport={false}
            onRowClick={(row) => navigate(ROUTES.MEMBERS.DETAIL(row.id))}
            onExportAll={async () => {
              const params: any = {};
              if (debouncedSearch) {
                params.search = debouncedSearch;
              }
              if (sortBy && sortBy !== 'date') {
                params.sortBy = sortBy;
              }
              if (activeTab !== 'all') params.status = activeTab;
              if (genderFilter) params.gender = genderFilter;
              return fetchAllPages((pageParams) => memberService.getAll({ ...params, ...pageParams }));
            }}
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
