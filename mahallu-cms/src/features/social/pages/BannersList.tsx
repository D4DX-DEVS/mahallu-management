import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiImage, FiCheckCircle } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import RowActions from '@/components/ui/RowActions';
import ListToolbar from '../components/ListToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { socialService, Banner } from '@/services/socialService';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { shareViz } from '@/utils/statSeries';

export default function BannersList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
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
      setError(getFriendlyError(err, "Couldn't load banners. Refresh the page or try again."));
      console.error('Error fetching banners:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      
      const params: any = { limit: 10000 };
      const result = await socialService.getAllBanners(params);
      const dataToExport = result.data;

      if (dataToExport.length === 0) {
        toast.info('Nothing to export. Change your filters and try again.');
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
      toast.error(getFriendlyError(error, "Couldn't export data. Check your connection and try again."));
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
      toast.error(getFriendlyError(err, "Couldn't delete banner. Try again in a moment."));
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn<Banner>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'title', label: 'Title', sortable: true },
    {
      key: 'status',
      label: 'Status',
      render: (status) => <StatusBadge status={status || 'active'} />,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (date) => formatDate(date),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <RowActions
          onEdit={() => navigate(`/social/banners/${row.id}/edit`)}
          onDelete={() => {
            setSelectedBanner(row);
            setShowDeleteModal(true);
          }}
          ariaLabels={{ edit: 'Edit banner', delete: 'Delete banner' }}
        />
      ),
    },
  ];

  const stats = [
    { title: 'Total Banners', value: pagination?.total || banners.length, icon: <FiImage className="h-[17px] w-[17px]" />, tone: 'green' as const },
    {
      title: 'Active',
      value: banners.filter((b) => b.status === 'active' || !b.status).length, viz: shareViz(banners.filter((b) => b.status === 'active' || !b.status).length, banners.length), summary: `Active: ${banners.filter((b) => b.status === 'active' || !b.status).length} of ${banners.length}`,
      icon: <FiCheckCircle className="h-[17px] w-[17px]" />,
      tone: 'lime' as const,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Banners"
        description="Manage banners"
        actions={
          <Link to="/social/banners/create">
            <Button>+ New banner</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {stats.map((stat, index) => (
          <StatCard key={index} variant="inline" {...stat} />
        ))}
      </div>

      <Card padding="none" className="overflow-visible">
        <ListToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search banners"
          onRefresh={fetchBanners}
          onExport={handleExport}
          isExporting={isExporting}
        />

        <div className="p-3.5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : error ? (
            <div className="py-12 text-center">
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <Button onClick={fetchBanners} className="mt-4" variant="outline">
                Retry
              </Button>
            </div>
          ) : (
            <Table columns={columns} data={banners} emptyMessage="No banners found" showExport={false} />
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
          setSelectedBanner(null);
          setDeleting(false);
        }}
        title="Delete banner?"
        footer={
          <>
            <Button
              variant="secondary"
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
        <p className="text-[13px] text-[#3A4741] dark:text-surface-muted">
          Delete <strong>{selectedBanner?.title}</strong>? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

