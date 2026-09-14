import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiCheckCircle, FiEdit2, FiImage, FiPlus, FiTrash2 } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import { rowActionClass } from '@/components/ui/rowAction';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Modal from '@/components/ui/Modal';
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

export default function BannersList() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBanner, setSelectedBanner] = useState<Banner | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);

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
      console.error('Error fetching banners:', err);
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

  const handleDelete = async () => {
    if (!selectedBanner) return;
    try {
      setDeleting(true);
      await socialService.deleteBanner(selectedBanner.id);
      await fetchBanners();
      setShowDeleteModal(false);
      setSelectedBanner(null);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'delete banner' }));
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
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <Link
            to={`/social/banners/${row.id}/edit`}
            className={rowActionClass()}
            title="Edit"
          >
            <FiEdit2 className="h-4 w-4" />
          </Link>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedBanner(row);
              setShowDeleteModal(true);
            }}
            className={rowActionClass('danger')}
            title="Delete"
            aria-label="Delete"
          >
            <FiTrash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const stats = [
    {
      title: 'Total Banners',
      value: pagination?.total || banners.length,
      icon: <FiImage className="h-5 w-5" />,
    },
    {
      title: 'Active',
      value: banners.filter((b) => b.status === 'active' || !b.status).length,
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
          <div className="text-center py-10">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchBanners} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <Table fixedLayout striped columns={columns} data={banners} emptyMessage="No banners found" showExport={false} />
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
          setSelectedBanner(null);
          setDeleting(false);
        }}
        title="Delete Banner"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedBanner(null);
                setDeleting(false);
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
          Are you sure you want to delete <strong>{selectedBanner?.title}</strong>? This action cannot be
          undone.
        </p>
      </Modal>
    </div>
  );
}
