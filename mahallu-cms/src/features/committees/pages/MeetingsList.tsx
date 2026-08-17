import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEye, FiTrash2, FiCalendar, FiX, FiClock, FiCheckCircle } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { toast } from '@/store/toastStore';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { Meeting, Committee } from '@/types';
import { meetingService } from '@/services/meetingService';
import { committeeService } from '@/services/committeeService';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';

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
      setError(err.response?.data?.message || 'Failed to fetch meetings');
      console.error('Error fetching meetings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      
      const params: any = { limit: 10000 };
      if (committeeFilter !== 'all') params.committeeId = committeeFilter;
      
      const result = await meetingService.getAll(params);
      const dataToExport = result.data;

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
      toast.error(error?.message || 'Failed to export meetings');
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
      setError(err.response?.data?.message || 'Failed to delete meeting');
      setDeleting(false);
    }
  };

  const columns: TableColumn<Meeting>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'title', label: 'Title', sortable: true },
    {
      key: 'committeeName',
      label: 'Committee',
      render: (name, row) => name || (row.committeeId as any)?.name || '-',
    },
    {
      key: 'meetingDate',
      label: 'Date',
      render: (date) => formatDate(date),
    },
    {
      key: 'status',
      label: 'Status',
      render: (status) => {
        const statusColors: Record<string, string> = {
          scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
          completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
          cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
        };
        return (
          <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status || 'scheduled']}`}>
            {status || 'scheduled'}
          </span>
        );
      },
    },
    {
      key: 'attendancePercent',
      label: 'Attendance',
      render: (percent) => `${percent || 0}%`,
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/committees/meetings/${row.id}`);
            }}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            title="View"
          >
            <FiEye className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedMeeting(row);
              setShowDeleteModal(true);
            }}
            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
            title="Delete"
          >
            <FiTrash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const stats = [
    { title: 'Total Meetings', value: pagination?.total || meetings.length, icon: <FiCalendar className="h-5 w-5" /> },
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Meetings</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Manage committee meetings</p>
          </div>
          <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Meetings' }]} />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      <Card>
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
              <Button size="md">
                + New Meeting
              </Button>
            </Link>
          }
        />

        {isFilterVisible && (
          <div className="relative flex flex-wrap items-center gap-4 mb-6 p-4 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700">
            <button
              onClick={() => setIsFilterVisible(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <FiX className="h-4 w-4" />
            </button>
            <div className="w-64">
              <Select
                options={[
                  { value: 'all', label: 'All Committees' },
                  ...(Array.isArray(committees) ? committees : []).map((c) => ({ value: c.id, label: c.name })),
                ]}
                value={committeeFilter}
                onChange={(e) => setCommitteeFilter(e.target.value)}
              />
            </div>
          </div>
        )}

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchMeetings} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <Table
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
      </Card>

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
          Are you sure you want to delete <strong>{selectedMeeting?.title}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

