import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FiCheckCircle, FiEdit2, FiImage, FiPlus, FiTrash2 } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import ActionsMenu from '@/components/ui/ActionsMenu';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import { PageSkeleton } from '@/components/ui/Skeleton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { socialService, Banner } from '@/services/socialService';
import { fetchAllPages } from '@/services/api';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { useServerCounts } from '@/hooks/useServerCounts';
import { logError } from '@/utils/safeLog';

export default function BannersList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBanner, setSelectedBanner] = useState<Banner | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(() => {
    const page = Number(searchParams.get('page'));
    return page > 0 ? page : 1;
  });
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // Keep the page number in the URL so returning from edit/create restores it.
  useEffect(() => {
    const next = new URLSearchParams();
    if (currentPage > 1) next.set('page', String(currentPage));
    setSearchParams(next, { replace: true });
  }, [currentPage, setSearchParams]);

  useEffect(() => {
    fetchBanners();
  }, [currentPage]);

  const fetchBanners = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
      };
      const result = await socialService.getAllBanners(params);
      setBanners(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(loadErrorMessage(err, 'banners'));
      logError('Error fetching banners', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);

      const dataToExport = await fetchAllPages<Banner>(({ page, limit }) =>
        socialService.getAllBanners({ page, limit })
      );

      if (dataToExport.length === 0) {
        toast.info('No data to export');
        return;
      }

      const filename = 'banners';
      const title = 'All Banners';

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
      toast.error(errorMessage(error, { action: 'export data' }));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedBanner) return;
    try {
      setDeleting(true);
      await socialService.deleteBanner(selectedBanner.id);
      await fetchBanners();
      toast.success('Banner deleted');
      setShowDeleteModal(false);
      setSelectedBanner(null);
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete banner' }));
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn<Banner>[] = [
    { key: 'title', label: 'Title', width: '6.25rem', sortable: true },
    {
      key: 'status',
      label: 'Status',
      width: '7.25rem',
      render: (status) => (
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            status === 'active'
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}
        >
          {status || 'active'}
        </span>
      ),
    },
    {
      key: 'createdAt',
      label: 'Created',
      width: '7.75rem',
      render: (date) => formatDate(date),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '8rem',
      align: 'center',
      render: (_, row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <ActionsMenu
            label={`Actions for ${row.title}`}
            items={[
              {
                label: 'Edit',
                icon: <FiEdit2 className="h-4 w-4" />,
                onClick: () => navigate(`/social/banners/${row.id}/edit`),
              },
              {
                label: 'Delete',
                icon: <FiTrash2 className="h-4 w-4" />,
                variant: 'danger',
                onClick: () => {
                  setSelectedBanner(row);
                  setShowDeleteModal(true);
                },
              },
            ]}
          />
        </div>
      ),
    },
  ];

  // Whole-list counts from the server: these cards used to count only the rows on this page.
  const statusCounts = useServerCounts(
    { active: () => socialService.getAllBanners({ status: 'active', page: 1, limit: 1 }) },
    [banners]
  );

  const stats = [
    {
      title: 'Total Banners',
      value: pagination?.total || banners.length,
      icon: <FiImage className="h-5 w-5" />,
    },
    {
      title: 'Active',
      value: statusCounts.active ?? banners.filter((b) => b.status === 'active' || !b.status).length,
      icon: <FiCheckCircle className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <PageHeader title="Banners" description="Manage banners" />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
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
          hasFilters={false}
          onRefresh={fetchBanners}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={
            <Link to="/social/banners/create">
              <Button size="md" icon={<FiPlus />} collapseLabel>New Banner</Button>
            </Link>
          }
        />

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <EmptyState
            variant="error"
            entity="banners"
            description={error}
            action={{ label: 'Retry', onClick: fetchBanners }}
          />
        ) : (
          <Table
            fixedLayout
            striped
            columns={columns}
            data={banners}
            emptyMessage="No banners found"
            showExport={false}
            onRowClick={(row) => {
              setSelectedBanner(row);
              setShowViewModal(true);
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

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedBanner(null);
        }}
        title="Banner Details"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowViewModal(false);
                setSelectedBanner(null);
              }}
            >
              Close
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (selectedBanner) navigate(`/social/banners/${selectedBanner.id}/edit`);
              }}
            >
              Edit
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setShowViewModal(false);
                setShowDeleteModal(true);
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        {selectedBanner && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Title</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">{selectedBanner.title}</p>
            </div>
            {selectedBanner.image && (
              <div className="sm:col-span-2">
                <img src={selectedBanner.image} alt={selectedBanner.title} className="max-h-40 rounded-md" />
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
              <p className="text-gray-900 dark:text-gray-100 capitalize">{selectedBanner.status || 'active'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Link</p>
              <p className="text-gray-900 dark:text-gray-100 break-all">{selectedBanner.link || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Start Date</p>
              <p className="text-gray-900 dark:text-gray-100">
                {selectedBanner.startDate ? formatDate(selectedBanner.startDate) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">End Date</p>
              <p className="text-gray-900 dark:text-gray-100">
                {selectedBanner.endDate ? formatDate(selectedBanner.endDate) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
              <p className="text-gray-900 dark:text-gray-100">{formatDate(selectedBanner.createdAt)}</p>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteModal}
        title="Delete banner"
        message={`Are you sure you want to delete ${selectedBanner?.title ? `"${selectedBanner.title}"` : 'this banner'}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setShowDeleteModal(false);
          setSelectedBanner(null);
          setDeleting(false);
        }}
      />
    </div>
  );
}
