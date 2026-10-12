import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiCalendar, FiClock, FiCheckCircle, FiRefreshCw, FiDownload, FiFileText, FiFile } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { Meeting, Committee } from '@/types';
import { meetingService } from '@/services/meetingService';
import { committeeService } from '@/services/committeeService';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import StatusBadge from '@/components/ui/StatusBadge';
import RowActions from '@/components/ui/RowActions';
import Dropdown from '@/components/ui/Dropdown';
import { monthlySeries, pct } from '@/utils/statSeries';
import { PersonCell } from '@/components/ui/Avatar';

export default function MeetingsList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
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
      const result = await committeeService.getAll({ limit: 1000 });
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
      setError(getFriendlyError(err, "Couldn't load meetings. Refresh the page or try again."));
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
        toast.info('Nothing to export. Change your filters and try again.');
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
      toast.error(getFriendlyError(error, "Couldn't export meetings. Check your connection and try again."));
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
      toast.error(getFriendlyError(err, "Couldn't delete meeting. Try again in a moment."));
      setDeleting(false);
    }
  };

  const columns: TableColumn<Meeting>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'title', label: 'Title', sortable: true, render: (v) => <PersonCell name={v} /> },
    {
      key: 'committeeName',
      label: 'Committee',
      render: (name, row) => { const n = name || (row.committeeId as any)?.name; return n ? <PersonCell name={n} size={24} /> : '-'; },
    },
    {
      key: 'meetingDate',
      label: 'Date',
      render: (date) => formatDate(date),
    },
    {
      key: 'status',
      label: 'Status',
      render: (status) => <StatusBadge status={status || 'scheduled'} />,
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
        <RowActions
          onView={() => navigate(`/committees/meetings/${row.id}`)}
          viewLabel="View"
          onDelete={() => {
            setSelectedMeeting(row);
            setShowDeleteModal(true);
          }}
          deleteLabel="Delete"
          ariaLabels={{ view: 'View meeting', delete: 'Delete meeting' }}
        />
      ),
    },
  ];

  const stats = [
    { title: 'Total Meetings', value: pagination?.total || meetings.length, icon: <FiCalendar className="h-[17px] w-[17px]" />,
      tone: 'green' as const,
      viz: monthlySeries(meetings, (m) => m.meetingDate).length ? { type: 'bars' as const, values: monthlySeries(meetings, (m) => m.meetingDate) } : undefined },
    {
      title: 'Scheduled',
      value: meetings.filter((m) => m.status === 'scheduled' || !m.status).length,
      icon: <FiClock className="h-[17px] w-[17px]" />,
      tone: 'lime' as const,
      viz: meetings.filter((m) => m.status === 'scheduled' || !m.status).length > 0 ? { type: 'dots' as const, count: meetings.filter((m) => m.status === 'scheduled' || !m.status).length } : undefined,
      summary: `${meetings.filter((m) => m.status === 'scheduled' || !m.status).length} meetings scheduled`,
    },
    {
      title: 'Completed',
      value: meetings.filter((m) => m.status === 'completed').length,
      icon: <FiCheckCircle className="h-[17px] w-[17px]" />,
      tone: 'neutral' as const,
      viz: meetings.length > 0 ? { type: 'ring' as const, percent: pct(meetings.filter((m) => m.status === 'completed').length, meetings.length) } : undefined,
      summary: `${meetings.filter((m) => m.status === 'completed').length} of ${meetings.length} meetings completed`,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Meetings"
        description="Manage committee meetings"
        actions={
          <Link to="/committees/meetings/create">
            <Button>+ New Meeting</Button>
          </Link>
        }
      />

<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <StatCard key={index} variant="inline" {...stat} />
          ))}
        </div>

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search meetings' }}
          actions={
            <>
              <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={fetchMeetings}>
                <FiRefreshCw className="h-3.5 w-3.5" />
              </Button>
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
          <div className="w-64">
            <Select
              aria-label="Filter by committee"
              options={[
                { value: 'all', label: 'All Committees' },
                ...(Array.isArray(committees) ? committees : []).map((c) => ({ value: c.id, label: c.name })),
              ]}
              value={committeeFilter}
              onChange={(e) => setCommitteeFilter(e.target.value)}
            />
          </div>
        </FilterBar>

        <div className="p-3.5">

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchMeetings} className="mt-4" variant="secondary">
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

      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedMeeting(null);
        }}
        title="Delete meeting?"
        footer={
          <>
            <Button
              variant="secondary"
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
        <p className="text-[#5B6963] dark:text-surface-muted">
          Delete <strong>{selectedMeeting?.title}</strong>? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

