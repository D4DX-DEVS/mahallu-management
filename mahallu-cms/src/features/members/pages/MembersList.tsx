import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiUsers, FiUser, FiUserCheck, FiRefreshCw, FiDownload, FiFileText, FiFile } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import BloodGroupBadge from '@/components/ui/BloodGroupBadge';
import GenderChip from '@/components/ui/GenderChip';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { Member } from '@/types';
import { memberService } from '@/services/memberService';
import { ROUTES } from '@/constants/routes';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import Dropdown from '@/components/ui/Dropdown';
import Segmented from '@/components/ui/Segmented';
import SavedViews from '@/components/ui/SavedViews';
import AppliedFilters from '@/components/ui/AppliedFilters';
import TableColumnMenu from '@/components/ui/TableColumnMenu';
import BulkBarButton from '@/components/ui/BulkBarButton';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useTableView } from '@/hooks/useTableView';
import { useDetailModal } from '@/hooks/useDetailModal';
import MemberQuickView from '../components/MemberQuickView';
import { pct } from '@/utils/statSeries';

export default function MembersList() {
  const navigate = useNavigate();
  const filters = useUrlFilters({ sort: 'date' });
  const { search: searchQuery, setSearch: setSearchQuery, debouncedSearch, page: currentPage, setPage: setCurrentPage, pageSize: itemsPerPage } = filters;
  const sortBy = filters.values.sort;
  const setSortBy = (v: string) => filters.setFilter('sort', v);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const detail = useDetailModal(members.map((m) => String(m.id)));
  
  useEffect(() => {
    fetchMembers();
  }, [debouncedSearch, sortBy, currentPage, itemsPerPage]);

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
      if (sortBy) {
        params.sortBy = sortBy === 'mahallId' ? 'mahallId' : 'date';
      }
      const result = await memberService.getAll(params);
      setMembers(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load members. Refresh the page or try again."));
      console.error('Error fetching members:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      const params: any = { limit: 10000 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (sortBy) params.sortBy = sortBy === 'mahallId' ? 'mahallId' : 'date';
      const result = await memberService.getAll(params);
      const dataToExport = result.data;
      if (dataToExport.length === 0) {
        toast.info('Nothing to export. Change your filters and try again.');
        return;
      }
      const filename = 'members';
      const title = 'All Members';
      switch (type) {
        case 'csv': exportToCSV(columns, dataToExport, filename); break;
        case 'json': exportToJSON(columns, dataToExport, filename); break;
        case 'pdf': exportToPDF(columns, dataToExport, filename, title); break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(getFriendlyError(error, "Couldn't export data. Check your connection and try again."));
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<Member>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => (currentPage - 1) * itemsPerPage + index + 1 },
    { key: 'mahallId', label: 'Mahall ID', render: (id) => id || '-' },
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (name, row) => (
        <PersonCell name={name} src={row.photoUrl} subtitle={row.isFamilyHead ? 'Family head' : undefined} />
      ),
    },
    { key: 'familyName', label: 'Family Name' },
    {
      key: 'age',
      label: 'Age / Gender',
      render: (_, row) => (
        <span className="inline-flex items-center gap-2">
          <span>{row.age ? `${row.age}` : '-'}</span>
          <GenderChip value={row.gender} />
        </span>
      ),
    },
    { key: 'bloodGroup', label: 'Blood Group', render: (bg) => <BloodGroupBadge value={bg} /> },
    {
      key: 'healthStatus',
      label: 'Health Status',
      defaultHidden: true,
      render: (status) => status || '-',
    },
    { key: 'phone', label: 'Phone', render: (phone) => phone || '-' },
    {
      key: 'education',
      label: 'Educations',
      defaultHidden: true,
      render: (edu) => edu || '-',
    },
    {
      key: 'actions',
      label: 'Actions',
      hideable: false,
      render: (_, row) => (
        <RowActions
          onView={() => detail.open(String(row.id))}
          onEdit={() => navigate(ROUTES.MEMBERS.EDIT(row.id))}
        />
      ),
    },
  ];

  const view = useTableView('members', columns);
  const exportSelected = (ids: string[]) => {
    const rows = members.filter((m) => ids.includes(String(m.id)));
    exportToCSV(columns.filter((c) => c.key !== 'actions'), rows, 'members-selected');
    toast.success(`Exported ${rows.length} ${rows.length === 1 ? 'member' : 'members'}`);
  };

  const stats = [
    { title: 'Total Family Members', value: pagination?.total || members.length, icon: <FiUsers className="h-[17px] w-[17px]" />,
      tone: 'green' as const,
      viz: members.length > 0 ? { type: 'segments' as const, segments: [{ value: members.filter((m) => m.gender === 'male').length }, { value: members.filter((m) => m.gender === 'female').length, color: '#8EC13E' }] } : undefined,
      summary: `Family members ${pagination?.total || members.length}` },
    {
      title: 'Total Males',
      value: members.filter((m) => m.gender === 'male').length,
      icon: <FiUser className="h-[17px] w-[17px]" />,
      tone: 'lime' as const,
      viz: members.length > 0 ? { type: 'ring' as const, percent: pct(members.filter((m) => m.gender === 'male').length, members.length) } : undefined,
      summary: `Males ${members.filter((m) => m.gender === 'male').length} of ${members.length} listed, ${pct(members.filter((m) => m.gender === 'male').length, members.length)} percent`,
    },
    {
      title: 'Total Females',
      value: members.filter((m) => m.gender === 'female').length,
      icon: <FiUserCheck className="h-[17px] w-[17px]" />,
      tone: 'neutral' as const,
      viz: members.length > 0 ? { type: 'ring' as const, percent: pct(members.filter((m) => m.gender === 'female').length, members.length), color: '#8EC13E' } : undefined,
      summary: `Females ${members.filter((m) => m.gender === 'female').length} of ${members.length} listed, ${pct(members.filter((m) => m.gender === 'female').length, members.length)} percent`,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="All Family Members"
        description="Manage family members and their information"
        actions={
          <Link to={ROUTES.MEMBERS.CREATE}>
            <Button>+ New Member</Button>
          </Link>
        }
      />

{/* Statistics Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <StatCard key={index} variant="inline" {...stat} />
          ))}
        </div>

      {/* Actions and Filters */}
      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search members' }}
          actions={
            <>
              <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={fetchMembers}>
                <FiRefreshCw className="h-3.5 w-3.5" />
              </Button>
              <TableColumnMenu {...view.menuProps} />
              <Dropdown
                trigger={
                  <Button variant="secondary" isLoading={isExporting}>
                    {!isExporting && <FiDownload className="h-3.5 w-3.5" />}
                    Export
                  </Button>
                }
                items={[
                  { label: 'Export CSV', icon: <FiFileText />, onClick: () => handleExport('csv'), disabled: isExporting },
                  { label: 'Export JSON', icon: <FiFile />, onClick: () => handleExport('json'), disabled: isExporting },
                  { label: 'Export PDF', icon: <FiDownload />, onClick: () => handleExport('pdf'), disabled: isExporting },
                ]}
              />
            </>
          }
        >
          <Segmented
            aria-label="Sort members by"
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: 'date', label: 'Newest' },
              { value: 'mahallId', label: 'Mahall ID' },
              { value: 'name', label: 'Name' },
            ]}
          />
          <SavedViews pageKey="members" filters={filters} />
        </FilterBar>
        <AppliedFilters filters={filters} config={{ sort: { label: 'Sort', format: (v) => (v === 'mahallId' ? 'Mahall ID' : v === 'name' ? 'Name' : 'Newest') } }} />

        <div className="p-3.5">

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchMembers} className="mt-4" variant="secondary">
              Retry
            </Button>
          </div>
        ) : (
          <Table
            columns={view.columns}
            density={view.density}
            selectable
            filtersActive={filters.activeCount > 0}
            onClearFilters={filters.clear}
            bulkActions={(ids) => (
              <BulkBarButton onClick={() => exportSelected(ids)}>
                <FiDownload className="h-3.5 w-3.5" /> Export selected
              </BulkBarButton>
            )}
            data={members}
            emptyMessage="No Members Yet"
            exportFilename="members"
            exportTitle="All Family Members"
            showExport={false}
            onRowClick={(row) => detail.open(String(row.id))}
            onExportAll={async () => {
              // Fetch all filtered data without pagination
              const params: any = {
                limit: 10000, // Large limit to get all data
              };
              if (debouncedSearch) {
                params.search = debouncedSearch;
              }
              if (sortBy) {
                params.sortBy = sortBy === 'mahallId' ? 'mahallId' : 'date';
              }
              const result = await memberService.getAll(params);
              return result.data;
            }}
          />
        )}

        {/* Pagination */}
        {pagination && (
          <div className="mt-3.5">
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
        </div>
      </Card>

      <MemberQuickView detail={detail} rows={members} canEdit onChanged={fetchMembers} />
    </div>
  );
}

