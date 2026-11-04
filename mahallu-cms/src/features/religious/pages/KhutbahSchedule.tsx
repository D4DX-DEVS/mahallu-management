import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiTrash2, FiPlus, FiCalendar } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import TableToolbar from '@/components/ui/TableToolbar';
import FilterPanel from '@/components/ui/FilterPanel';
import Input from '@/components/ui/Input';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import { toast } from '@/store/toastStore';
import { Khutbah, religiousService, KHUTBAH_STATUS_OPTIONS } from '@/services/religiousService';
import { formatDate, toTitleCase } from '@/utils/format';
import { ROUTES } from '@/constants/routes';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';

export default function KhutbahSchedule() {
  const navigate = useNavigate();
  const [khutbahs, setKhutbahs] = useState<Khutbah[]>([]);
  const [upcomingKhutbah, setUpcomingKhutbah] = useState<Khutbah | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [pagination, setPagination] = useState<any>(null);
  const [selectedKhutbah, setSelectedKhutbah] = useState<Khutbah | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [viewingKhutbah, setViewingKhutbah] = useState<Khutbah | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().split('T')[0].slice(0, 7)
  );

  const thisMonth = new Date().toISOString().split('T')[0].slice(0, 7);
  const isFiltered = selectedMonth !== thisMonth;

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

  const fetchKhutbahs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await religiousService.getAllKhutbahs({
        page: currentPage,
        limit: itemsPerPage,
        month: selectedMonth,
      });
      setKhutbahs(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err) {
      setError(loadErrorMessage(err, 'khutbahs'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, selectedMonth]);

  useEffect(() => {
    fetchUpcomingKhutbah();
  }, [selectedMonth, currentPage]);

  useEffect(() => {
    fetchKhutbahs();
  }, [fetchKhutbahs]);

  const handleDelete = async () => {
    if (!selectedKhutbah) return;
    try {
      setDeleting(true);
      await religiousService.deleteKhutbah(selectedKhutbah.id);
      toast.success('Khutbah deleted');
      setShowDeleteModal(false);
      setSelectedKhutbah(null);
      fetchKhutbahs();
      fetchUpcomingKhutbah();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete khutbah' }));
    } finally {
      setDeleting(false);
    }
  };

  const getKhateebName = (khutbah: Khutbah): string => {
    if (khutbah.khateebId && typeof khutbah.khateebId === 'object') {
      return toTitleCase(khutbah.khateebId.name);
    }
    return '—';
  };

  const columns = [
    {
      key: 'date',
      label: 'Date',
      sortable: true,
      width: '10rem',
      render: (_: any, khutbah: Khutbah) => formatDate(khutbah.date),
    },
    {
      key: 'topic',
      label: 'Topic',
      sortable: true,
      width: '20rem',
      render: (_: any, khutbah: Khutbah) => <span className="font-medium text-foreground">{toTitleCase(khutbah.topic)}</span>,
    },
    {
      key: 'khateebId',
      label: 'Khateeb',
      sortable: false,
      priority: 'secondary' as const,
      width: '14rem',
      render: (_: any, khutbah: Khutbah) => getKhateebName(khutbah),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      width: '8rem',
      render: (_: any, khutbah: Khutbah) => <StatusBadge status={khutbah.status} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Khutbah schedule"
        description="Friday khutbah topics and khateebs, month by month."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => navigate(ROUTES.RELIGIOUS.KHUTBAHS_CREATE)}>
            New khutbah
          </Button>
        }
      />

      {upcomingKhutbah && (
        <Card className="mb-6 border-l-4 border-primary">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
                <FiCalendar aria-hidden="true" /> Next khutbah
              </h3>
              <p className="mt-0.5 text-sm text-muted-foreground">{formatDate(upcomingKhutbah.date)}</p>
              <p className="mt-2 font-medium text-foreground">{toTitleCase(upcomingKhutbah.topic)}</p>
              {upcomingKhutbah.topicMl && <p className="text-sm text-muted-foreground">{upcomingKhutbah.topicMl}</p>}
              <p className="mt-1 text-sm text-muted-foreground">Khateeb: {getKhateebName(upcomingKhutbah)}</p>
            </div>
            <StatusBadge status="upcoming" />
          </div>
        </Card>
      )}

      <TableCard>
        <TableToolbar
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={isFiltered ? 1 : 0}
          onRefresh={fetchKhutbahs}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-52">
              <Input
                label="Month"
                type="month"
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            {isFiltered && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSelectedMonth(thisMonth);
                  setCurrentPage(1);
                }}
              >
                This month
              </Button>
            )}
          </FilterPanel>
        )}

        {error ? (
          <EmptyState variant="error" entity="khutbahs" description={error} action={{ label: 'Try again', onClick: fetchKhutbahs }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={khutbahs}
              isLoading={loading}
              entity="khutbahs"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Show this month', onClick: () => { setSelectedMonth(thisMonth); setCurrentPage(1); } }
                  : { label: 'Add khutbah', onClick: () => navigate(ROUTES.RELIGIOUS.KHUTBAHS_CREATE) }
              }
              onRowClick={(row) => setViewingKhutbah(row)}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="khutbahs"
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

      <ConfirmDialog
        isOpen={showDeleteModal}
        title={`Delete the khutbah on ${selectedKhutbah ? formatDate(selectedKhutbah.date) : 'this date'}?`}
        message="This permanently removes the khutbah and cannot be undone."
        confirmLabel="Delete khutbah"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />

      {/* View Modal */}
      <Modal
        isOpen={!!viewingKhutbah}
        onClose={() => setViewingKhutbah(null)}
        title="Khutbah Details"
        footer={
          <>
            <Button variant="outline" onClick={() => setViewingKhutbah(null)}>
              Close
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (viewingKhutbah) navigate(`${ROUTES.RELIGIOUS.KHUTBAHS}/${viewingKhutbah.id}/edit`);
                setViewingKhutbah(null);
              }}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (viewingKhutbah) {
                  setSelectedKhutbah(viewingKhutbah);
                  setShowDeleteModal(true);
                }
                setViewingKhutbah(null);
              }}
              icon={<FiTrash2 />}
            >
              Delete
            </Button>
          </>
        }
      >
        {viewingKhutbah && (
          <div className="space-y-3">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Date</span>
              <p className="text-gray-900 dark:text-gray-100">{formatDate(viewingKhutbah.date)}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Topic</span>
              <p className="text-gray-900 dark:text-gray-100">{toTitleCase(viewingKhutbah.topic)}</p>
              {viewingKhutbah.topicMl && (
                <p className="text-sm text-gray-700 dark:text-gray-300">{viewingKhutbah.topicMl}</p>
              )}
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Khateeb</span>
              <p className="text-gray-900 dark:text-gray-100">{getKhateebName(viewingKhutbah)}</p>
            </div>
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Status</span>
              <p className="text-gray-900 dark:text-gray-100">
                {KHUTBAH_STATUS_OPTIONS.find((s) => s.value === viewingKhutbah.status)?.label}
              </p>
            </div>
            {viewingKhutbah.resourceUrl && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Resource URL</span>
                <p className="text-gray-900 dark:text-gray-100 break-all">{viewingKhutbah.resourceUrl}</p>
              </div>
            )}
            {viewingKhutbah.notes && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Notes</span>
                <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{viewingKhutbah.notes}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
