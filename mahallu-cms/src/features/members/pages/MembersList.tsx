import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEdit2, FiEye, FiPlus, FiUser, FiUserCheck, FiUsers } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import FilterPanel from '@/components/ui/FilterPanel';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
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
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';
import PageHeader from '@/components/layout/PageHeader';
import ActionsMenu from '@/components/ui/ActionsMenu';

export default function MembersList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [memberStats, setMemberStats] = useState({ totalMembers: 0, maleCount: 0, femaleCount: 0 });

  const debouncedSearch = useDebounce(searchQuery, 500);

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

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
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
    { key: 'mahallId', label: 'Mahall ID', width: '8.75rem', render: (id) => id || '-' },
    { key: 'name', label: 'Name', width: '6.75rem', sortable: true, render: (name) => toTitleCase(name) },
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
    { key: 'bloodGroup', label: 'Blood Group', width: '9.75rem', render: (bg) => bg || '-' },
    {
      key: 'healthStatus',
      label: 'Health Status',
      width: '10.75rem',
      render: (status) => status || '-',
    },
    { key: 'phone', label: 'Phone', width: '6.75rem', render: (phone) => phone || '-' },
    {
      key: 'education',
      label: 'Educations',
      width: '9rem',
      render: (edu) => edu || '-',
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '8rem',
      align: 'center',
      render: (_, row) => (
        <ActionsMenu
          items={[
            {
              label: 'View',
              icon: <FiEye className="h-4 w-4" />,
              onClick: () => {
                navigate(ROUTES.MEMBERS.DETAIL(row.id));
              },
            },
            {
              label: 'Edit',
              icon: <FiEdit2 className="h-4 w-4" />,
              onClick: () => {
                navigate(ROUTES.MEMBERS.EDIT(row.id));
              },
            },
          ]}
        />
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
    <div className="space-y-4">
      <div className="space-y-3">
        <PageHeader title="All Family Members" description="Manage family members and their information" />

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      {/* Actions and Filters */}
      <TableCard>
        <div className="flex flex-col gap-4 mb-4">
          <TableToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
            isFilterVisible={isFilterVisible}
            hasFilters={true}
            onRefresh={fetchMembers}
            onExport={handleExport}
            isExporting={isExporting}
            actionButtons={
              <Link to={ROUTES.MEMBERS.CREATE}>
                <Button size="md" icon={<FiPlus />} collapseLabel>New Member</Button>
              </Link>
            }
          />

          {isFilterVisible && (
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
