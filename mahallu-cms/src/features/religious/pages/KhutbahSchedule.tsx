import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiEdit2, FiTrash2, FiPlus, FiCalendar } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { Khutbah, religiousService, KHUTBAH_STATUS_OPTIONS } from '@/services/religiousService';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/format';
import { ROUTES } from '@/constants/routes';

export default function KhutbahSchedule() {
  const [khutbahs, setKhutbahs] = useState<Khutbah[]>([]);
  const [upcomingKhutbah, setUpcomingKhutbah] = useState<Khutbah | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<any>(null);
  const [selectedKhutbah, setSelectedKhutbah] = useState<Khutbah | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().split('T')[0].slice(0, 7)
  );

  useEffect(() => {
    fetchUpcomingKhutbah();
    fetchKhutbahs();
  }, [selectedMonth, currentPage]);

  const fetchUpcomingKhutbah = async () => {
    try {
      const result = await religiousService.getAllKhutbahs({
        upcoming: true,
        limit: 1,
      });
      if (result.data && result.data.length > 0) {
        setUpcomingKhutbah(result.data[0]);
      } else {
        setUpcomingKhutbah(null);
      }
    } catch (err) {
      console.error('Error fetching upcoming khutbah:', err);
    }
  };

  const fetchKhutbahs = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
        month: selectedMonth,
      };
      const result = await religiousService.getAllKhutbahs(params);
      setKhutbahs(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch khutbahs');
      console.error('Error fetching khutbahs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedKhutbah) return;
    try {
      setDeleting(true);
      await religiousService.deleteKhutbah(selectedKhutbah.id);
      setShowDeleteModal(false);
      setSelectedKhutbah(null);
      fetchKhutbahs();
      fetchUpcomingKhutbah();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete khutbah');
    } finally {
      setDeleting(false);
    }
  };

  const getKhateebName = (khutbah: Khutbah): string => {
    if (khutbah.khateebId && typeof khutbah.khateebId === 'object') {
      return khutbah.khateebId.name;
    }
    return '—';
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      scheduled: 'bg-blue-100 text-blue-800',
      delivered: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const columns = [
    {
      key: 'date',
      label: 'Date',
      render: (_: any, khutbah: Khutbah) => formatDate(khutbah.date),
    },
    {
      key: 'topic',
      label: 'Topic',
      render: (_: any, khutbah: Khutbah) => khutbah.topic,
    },
    {
      key: 'khateebId',
      label: 'Khateeb',
      render: (_: any, khutbah: Khutbah) => getKhateebName(khutbah),
    },
    {
      key: 'status',
      label: 'Status',
      render: (_: any, khutbah: Khutbah) => (
        <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(khutbah.status)}`}>
          {KHUTBAH_STATUS_OPTIONS.find((s) => s.value === khutbah.status)?.label}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_: any, khutbah: Khutbah) => (
        <div className="flex gap-2">
          <Link to={`${ROUTES.RELIGIOUS.KHUTBAHS}/${khutbah.id}/edit`}>
            <Button size="sm" variant="outline">
              <FiEdit2 className="inline mr-1" />
              Edit
            </Button>
          </Link>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedKhutbah(khutbah);
              setShowDeleteModal(true);
            }}
          >
            <FiTrash2 className="inline mr-1" />
            Delete
          </Button>
        </div>
      ),
    },
  ];

  if (loading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: ROUTES.DASHBOARD },
          { label: 'Khutbah Schedule', path: ROUTES.RELIGIOUS.KHUTBAHS },
        ]}
      />

      {error && <div className="p-4 bg-red-100 text-red-800 rounded">{error}</div>}

      {/* Upcoming Khutbah Card */}
      {upcomingKhutbah && (
        <Card className="border-l-4 border-blue-500 bg-blue-50">
          <div className="space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <FiCalendar /> Next Khutbah
                </h3>
                <p className="text-sm text-gray-600 mt-1">{formatDate(upcomingKhutbah.date)}</p>
              </div>
              <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                Upcoming
              </span>
            </div>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-600">Topic</p>
                <p className="font-medium">{upcomingKhutbah.topic}</p>
                {upcomingKhutbah.topicMl && <p className="text-sm text-gray-700">{upcomingKhutbah.topicMl}</p>}
              </div>
              <div>
                <p className="text-sm text-gray-600">Khateeb</p>
                <p className="font-medium">{getKhateebName(upcomingKhutbah)}</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Filters and Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="w-full sm:w-auto">
          <label className="block text-sm font-medium mb-2">Filter by Month</label>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => {
              setSelectedMonth(e.target.value);
              setCurrentPage(1);
            }}
            className="px-3 py-2 border rounded w-full sm:w-auto"
          />
        </div>
        <Link to={ROUTES.RELIGIOUS.KHUTBAHS_CREATE}>
          <Button className="w-full sm:w-auto">
            <FiPlus className="inline mr-2" />
            New Khutbah
          </Button>
        </Link>
      </div>

      {/* Khutbahs Table */}
      <Card>
        <Table columns={columns} data={khutbahs} />
      </Card>

      {pagination && <Pagination {...pagination} onPageChange={setCurrentPage} />}

      {/* Delete Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Confirm Delete">
        <div className="space-y-4">
          <p>Are you sure you want to delete this khutbah?</p>
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={deleting}
              isLoading={deleting}
            >
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
