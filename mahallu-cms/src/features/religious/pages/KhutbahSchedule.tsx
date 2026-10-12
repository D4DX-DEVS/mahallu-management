import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiPlus, FiCalendar } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import StatusBadge from '@/components/ui/StatusBadge';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import { TableColumn } from '@/types';
import Pagination from '@/components/ui/Pagination';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Input from '@/components/ui/Input';
import { Khutbah, religiousService, KHUTBAH_STATUS_OPTIONS } from '@/services/religiousService';
import { formatDate } from '@/utils/format';
import { ROUTES } from '@/constants/routes';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

export default function KhutbahSchedule() {
  const navigate = useNavigate();
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
      setError(getFriendlyError(err, "Couldn't load khutbahs. Refresh the page or try again."));
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
      toast.error(getFriendlyError(err, "Couldn't delete khutbah. Try again in a moment."));
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

  const columns: TableColumn<Khutbah>[] = [
    {
      key: 'date',
      label: 'Date',
      render: (_, khutbah) => formatDate(khutbah.date),
    },
    {
      key: 'topic',
      label: 'Topic',
      render: (_, khutbah) => <span className="font-semibold">{khutbah.topic}</span>,
    },
    {
      key: 'khateebId',
      label: 'Khateeb',
      render: (_, khutbah) => {
        const n = getKhateebName(khutbah);
        return n === '—' ? n : <PersonCell name={n} size={32} />;
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (_, khutbah) => (
        <StatusBadge
          status={khutbah.status}
          label={KHUTBAH_STATUS_OPTIONS.find((s) => s.value === khutbah.status)?.label}
          tone={khutbah.status === 'delivered' ? 'success' : undefined}
        />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, khutbah) => (
        <RowActions
          onEdit={() => navigate(`${ROUTES.RELIGIOUS.KHUTBAHS}/${khutbah.id}/edit`)}
          onDelete={() => {
            setSelectedKhutbah(khutbah);
            setShowDeleteModal(true);
          }}
          ariaLabels={{ edit: 'Edit khutbah', delete: 'Delete khutbah' }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Khutbah schedule"
        description="Upcoming and past Friday khutbahs"
        actions={
          <Link to={ROUTES.RELIGIOUS.KHUTBAHS_CREATE}>
            <Button>
              <FiPlus className="h-3.5 w-3.5" />
              New khutbah
            </Button>
          </Link>
        }
      />

      {error && <Alert tone="danger">{error}</Alert>}

      {/* Upcoming Khutbah Card */}
      {upcomingKhutbah && (
        <Card padding="lg" tint className="border-l-4 border-l-primary-600 dark:border-l-brand-lime">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="flex items-center gap-2 text-[13px] font-bold text-[#18231E] dark:text-surface-text">
                  <FiCalendar /> Next Khutbah
                </h3>
                <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">{formatDate(upcomingKhutbah.date)}</p>
              </div>
              <Badge variant="info" dot>Upcoming</Badge>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#7B8983] dark:text-surface-muted">Topic</p>
                <p className="mt-0.5 text-[13px] font-semibold">{upcomingKhutbah.topic}</p>
                {upcomingKhutbah.topicMl && <p className="text-xs text-[#5B6963] dark:text-surface-muted">{upcomingKhutbah.topicMl}</p>}
              </div>
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#7B8983] dark:text-surface-muted">Khateeb</p>
                <p className="mt-0.5 text-[13px] font-semibold">{getKhateebName(upcomingKhutbah)}</p>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Khutbahs Table */}
      <Card padding="none" className="overflow-visible">
        <FilterBar>
          <div className="w-44">
            <Input
              type="month"
              aria-label="Filter by month"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </FilterBar>

        <div className="p-3.5">
          {loading ? (
            <LoadingSpinner />
          ) : khutbahs.length === 0 ? (
            <EmptyState title="No khutbahs found" description="No khutbahs are scheduled for this month." />
          ) : (
            <Table columns={columns} data={khutbahs} showExport={false} />
          )}

          {pagination && (
            <div className="mt-3.5">
              <Pagination {...pagination} onPageChange={setCurrentPage} />
            </div>
          )}
        </div>
      </Card>

      {/* Delete Modal */}
      <ConfirmDialog
        isOpen={showDeleteModal}
        title="Confirm Delete"
        message="This khutbah will be deleted. This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </div>
  );
}
