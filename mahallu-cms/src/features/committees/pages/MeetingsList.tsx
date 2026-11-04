import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiCalendar, FiCheckCircle, FiClock, FiPlus } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import FilterPanel from '@/components/ui/FilterPanel';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { toast } from '@/store/toastStore';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { Meeting, Committee } from '@/types';
import { meetingService } from '@/services/meetingService';
import { committeeService } from '@/services/committeeService';
import { fetchAllPages } from '@/services/api';
import { formatDate, toTitleCase } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { loadErrorMessage } from '@/utils/errors';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';
import { useServerCounts } from '@/hooks/useServerCounts';
import { logError } from '@/utils/safeLog';

export default function MeetingsList() {
  const navigate = useNavigate();
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [committeeFilter, setCommitteeFilter] = useState('all');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchCommittees();
    fetchMeetings();
  }, [committeeFilter, currentPage, itemsPerPage]);

  const fetchCommittees = async () => {
    try {
      // Every committee, not just the API's default page of 10.
      const all = await fetchAllPages((p) => committeeService.getAll(p));
      setCommittees(all);
    } catch (err) {
      logError('Error fetching committees', err);
      setCommittees([]);
    }
  };

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
      };
      if (committeeFilter !== 'all') {
        params.committeeId = committeeFilter;
      }
      const result = await meetingService.getAll(params);
      setMeetings(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(loadErrorMessage(err, 'meetings'));
      logError('Error fetching meetings', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);

      const params: any = {};
      if (committeeFilter !== 'all') params.committeeId = committeeFilter;

      const dataToExport = await fetchAllPages((pageParams) =>
        meetingService.getAll({ ...params, ...pageParams })
      );

      if (dataToExport.length === 0) {
        toast.info('No meetings to export');
        return;
      }

      const filename = 'meetings';
      const title = 'All Meetings';

      switch (type) {
        case 'csv':
          exportToCSV(columns, dataToExport, filename);
          break;
        case 'json':
          exportToJSON(columns, dataToExport, filename);
          break;
        case 'pdf':
          await exportToPDF(columns, dataToExport, filename, title);
          break;
      }
    } catch (error: any) {
      logError('Export error', error);
      toast.error(error?.message || "Couldn't export meetings");
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<Meeting>[] = [
    { key: 'title', label: 'Title', width: '16rem', sortable: true, render: (v) => <span className="font-medium text-foreground">{toTitleCase(v)}</span> },
    {
      key: 'committeeName',
      label: 'Committee',
      width: '12rem',
      render: (name, row) => toTitleCase(name || (row.committeeId as any)?.name) || '-',
    },
    {
      key: 'meetingDate',
      label: 'Date',
      sortable: true,
      width: '8rem',
      render: (date) => formatDate(date),
    },
    {
      key: 'status',
      label: 'Status',
      width: '8rem',
      render: (status) => {
        return <StatusBadge status={status} />;
      },
    },
    {
      key: 'attendancePercent',
      label: 'Attendance',
      align: 'center',
      priority: 'secondary',
      width: '8rem',
      render: (percent) => `${percent || 0}%`,
    },
  ];

  // Whole-list counts from the server: these cards used to count only the rows on this page.
  const countBase = committeeFilter !== 'all' ? { committeeId: committeeFilter } : {};
  const statusCounts = useServerCounts(
    {
      scheduled: () => meetingService.getAll({ ...countBase, status: 'scheduled', page: 1, limit: 1 }),
      completed: () => meetingService.getAll({ ...countBase, status: 'completed', page: 1, limit: 1 }),
    },
    [meetings]
  );

  const stats = [
    {
      title: 'Total Meetings',
      value: pagination?.total || meetings.length,
      icon: <FiCalendar className="h-5 w-5" />,
    },
    {
      title: 'Scheduled',
      value: statusCounts.scheduled ?? meetings.filter((m) => m.status === 'scheduled' || !m.status).length,
      icon: <FiClock className="h-5 w-5" />,
    },
    {
      title: 'Completed',
      value: statusCounts.completed ?? meetings.filter((m) => m.status === 'completed').length,
      icon: <FiCheckCircle className="h-5 w-5" />,
    },
  ];

  const isFiltered = committeeFilter !== 'all';

  return (
    <>
      <PageHeader
        title="Meetings"
        description="Manage committee meetings."
        actions={
          <Link to="/committees/meetings/create">
            <Button icon={<FiPlus />} collapseLabel>New meeting</Button>
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      <TableCard>
        <TableToolbar
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={isFiltered ? 1 : 0}
          onRefresh={fetchMeetings}
          onExport={handleExport}
          isExporting={isExporting}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-64">
              <Select
                label="Committee"
                options={[
                  { value: 'all', label: 'All committees' },
                  ...(Array.isArray(committees) ? committees : []).map((c) => ({
                    value: c.id,
                    label: toTitleCase(c.name),
                  })),
                ]}
                value={committeeFilter}
                onChange={(e) => {
                  setCommitteeFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            {isFiltered && (
              <Button
                variant="ghost"
                onClick={() => {
                  setCommitteeFilter('all');
                  setCurrentPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterPanel>
        )}

        {error ? (
          <EmptyState variant="error" entity="meetings" description={error} action={{ label: 'Try again', onClick: fetchMeetings }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={meetings}
              isLoading={loading}
              entity="meetings"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setCommitteeFilter('all'); setCurrentPage(1); } }
                  : { label: 'Add meeting', onClick: () => navigate('/committees/meetings/create') }
              }
              onRowClick={(row) => navigate(`/committees/meetings/${row.id}`)}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="meetings"
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
