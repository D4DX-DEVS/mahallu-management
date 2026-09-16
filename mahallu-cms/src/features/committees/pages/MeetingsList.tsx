import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiCalendar, FiCheckCircle, FiClock, FiEye, FiPlus, FiTrash2 } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import FilterPanel from '@/components/ui/FilterPanel';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Modal from '@/components/ui/Modal';
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
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';
import ActionsMenu from '@/components/ui/ActionsMenu';

export default function MeetingsList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [committeeFilter, setCommitteeFilter] = useState('all');
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchCommittees();
    fetchMeetings();
  }, [committeeFilter, currentPage]);

  const fetchCommittees = async () => {
    try {
      const result = await committeeService.getAll();
      setCommittees(result.data || []);
    } catch (err) {
      console.error('Error fetching committees:', err);
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
      console.error('Error fetching meetings:', err);
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
          exportToPDF(columns, dataToExport, filename, title);
          break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error?.message || "Couldn't export meetings");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMeeting) return;
    try {
      setDeleting(true);
      await meetingService.delete(selectedMeeting.id);
      await fetchMeetings();
      setShowDeleteModal(false);
      setSelectedMeeting(null);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'delete meeting' }));
      setDeleting(false);
    }
  };

  const columns: TableColumn<Meeting>[] = [
    { key: 'title', label: 'Title', width: '6.25rem', sortable: true, render: (v) => toTitleCase(v) },
    {
      key: 'committeeName',
      label: 'Committee',
      width: '9.25rem',
      render: (name, row) => toTitleCase(name || (row.committeeId as any)?.name) || '-',
    },
    {
      key: 'meetingDate',
      label: 'Date',
      width: '6.25rem',
      render: (date) => formatDate(date),
    },
    {
      key: 'status',
      label: 'Status',
      width: '7.25rem',
      render: (status) => {
        return <StatusBadge status={status} />;
      },
    },
    {
      key: 'attendancePercent',
      label: 'Attendance',
      width: '9.25rem',
      render: (percent) => `${percent || 0}%`,
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
                navigate(`/committees/meetings/${row.id}`);
              },
            },
            {
              label: 'Delete',
              icon: <FiTrash2 className="h-4 w-4" />,
              onClick: () => {
                setSelectedMeeting(row);
                setShowDeleteModal(true);
              },
              variant: 'danger',
            },
          ]}
        />
      ),
    },
  ];

  const stats = [
    {
      title: 'Total Meetings',
      value: pagination?.total || meetings.length,
      icon: <FiCalendar className="h-5 w-5" />,
    },
    {
      title: 'Scheduled',
      value: meetings.filter((m) => m.status === 'scheduled' || !m.status).length,
      icon: <FiClock className="h-5 w-5" />,
    },
    {
      title: 'Completed',
      value: meetings.filter((m) => m.status === 'completed').length,
      icon: <FiCheckCircle className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <PageHeader title="Meetings" description="Manage committee meetings" />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
          isFilterVisible={isFilterVisible}
          hasFilters={true}
          onRefresh={fetchMeetings}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={
            <Link to="/committees/meetings/create">
              <Button size="md" icon={<FiPlus />} collapseLabel>New Meeting</Button>
            </Link>
          }
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-64">
              <Select
                options={[
                  { value: 'all', label: 'All Committees' },
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
          </FilterPanel>
        )}

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <EmptyState
            variant="error"
            entity="meetings"
            description={error}
            action={{ label: 'Retry', onClick: fetchMeetings }}
          />
        ) : (
          <Table
            fixedLayout
            striped
            columns={columns}
            data={meetings}
            emptyMessage="No meetings found"
            showExport={false}
            onRowClick={(row) => navigate(`/committees/meetings/${row.id}`)}
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

      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedMeeting(null);
        }}
        title="Delete Meeting"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedMeeting(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          Are you sure you want to delete <strong>{toTitleCase(selectedMeeting?.title)}</strong>? This action cannot be
          undone.
        </p>
      </Modal>
    </div>
  );
}
