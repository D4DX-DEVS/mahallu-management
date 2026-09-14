import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FiAlertTriangle, FiCheckCircle, FiEdit2, FiEye, FiPackage, FiPlus, FiTrash2, FiXCircle } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { Asset } from '@/types';
import { ROUTES } from '@/constants/routes';
import { assetService } from '@/services/assetService';
import { mosqueService, MosqueProfile } from '@/services/mosqueService';
import { fetchAllPages } from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { errorMessage } from '@/utils/errors';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';
import ActionsMenu from '@/components/ui/ActionsMenu';
import { toTitleCase } from '@/utils/format';

const categoryLabels: Record<string, string> = {
  furniture: 'Furniture',
  electronics: 'Electronics',
  vehicle: 'Vehicle',
  building: 'Building',
  land: 'Land',
  equipment: 'Equipment',
  other: 'Other',
};

const statusLabels: Record<string, string> = {
  active: 'Active',
  in_use: 'In Use',
  under_maintenance: 'Under Maintenance',
  disposed: 'Disposed',
  damaged: 'Damaged',
};

export default function AssetsList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(!!searchParams.get('mosqueId'));
  const [assets, setAssets] = useState<Asset[]>([]);
  const [mosques, setMosques] = useState<MosqueProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [mosqueFilter, setMosqueFilter] = useState(searchParams.get('mosqueId') || '');

  const debouncedSearch = useDebounce(searchQuery, 500);
  const mosqueName = (id: string) => mosques.find((m) => m.id === id)?.name;

  useEffect(() => {
    mosqueService
      .getAll({ limit: 100 })
      .then((result) => setMosques(result.data))
      .catch(() => setMosques([]));
  }, []);

  // A new search invalidates the current page offset
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchAssets();
  }, [debouncedSearch, currentPage, statusFilter, categoryFilter, mosqueFilter]);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;
      if (mosqueFilter) params.mosqueId = mosqueFilter;

      const result = await assetService.getAll(params);
      setAssets(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      console.error('Error fetching assets:', err);
      // Don't show error - just show empty state
      setAssets([]);
      setPagination(null);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      const filterParams: any = {};
      if (debouncedSearch) filterParams.search = debouncedSearch;
      if (statusFilter) filterParams.status = statusFilter;
      if (categoryFilter) filterParams.category = categoryFilter;
      if (mosqueFilter) filterParams.mosqueId = mosqueFilter;

      // The API caps `limit` at 100 and 400s above it, so a single
      // `limit: 10000` request never returned rows - fetch every page instead.
      const dataToExport = await fetchAllPages((pageParams) =>
        assetService.getAll({ ...filterParams, ...pageParams })
      );

      if (dataToExport.length === 0) {
        toast.info('No assets to export');
        return;
      }

      const filename = 'assets';
      const title = 'All Assets';

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
    if (!selectedAsset) return;
    try {
      setDeleting(true);
      await assetService.delete(selectedAsset.id);
      await fetchAssets();
      setShowDeleteModal(false);
      setSelectedAsset(null);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'delete asset' }));
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn<Asset>[] = [
    {
      key: 'name',
      label: 'Name',
      width: '6.75rem',
      sortable: true,
      render: (value) => <span>{toTitleCase(value)}</span>,
    },
    {
      key: 'category',
      label: 'Category',
      width: '8.25rem',
      render: (category) => categoryLabels[category] || category,
    },
    {
      key: 'mosqueId',
      label: 'Mosque',
      width: '7.5rem',
      render: (value) => (
        <span>{toTitleCase(typeof value === 'object' && value ? value.name : mosqueName(value) || '-')}</span>
      ),
    },
    {
      key: 'estimatedValue',
      label: 'Value (₹)',
      width: '8rem',
      render: (value) => value?.toLocaleString('en-IN') || '0',
    },
    {
      key: 'purchaseDate',
      label: 'Purchase Date',
      width: '11rem',
      render: (date) => formatDate(date),
    },
    {
      key: 'status',
      label: 'Status',
      width: '7.25rem',
      render: (status) => <StatusBadge status={status} />,
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
                navigate(ROUTES.ASSETS.DETAIL(row.id));
              },
            },
            {
              label: 'Edit',
              icon: <FiEdit2 className="h-4 w-4" />,
              onClick: () => {
                navigate(ROUTES.ASSETS.EDIT(row.id));
              },
            },
            {
              label: 'Delete',
              icon: <FiTrash2 className="h-4 w-4" />,
              onClick: () => {
                setSelectedAsset(row);
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
      title: 'Total Assets',
      value: pagination?.total || assets.length,
      icon: <FiPackage className="h-5 w-5" />,
    },
    {
      title: 'Active',
      value: assets.filter((a) => a.status === 'active' || a.status === 'in_use').length,
      icon: <FiCheckCircle className="h-5 w-5" />,
    },
    {
      title: 'Under Maintenance',
      value: assets.filter((a) => a.status === 'under_maintenance').length,
      icon: <FiAlertTriangle className="h-5 w-5" />,
    },
    {
      title: 'Disposed / Damaged',
      value: assets.filter((a) => a.status === 'disposed' || a.status === 'damaged').length,
      icon: <FiXCircle className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <PageHeader title="Asset Management" description="Manage your mahallu assets" />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-4">
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
          hasFilters={!!statusFilter || !!categoryFilter || !!mosqueFilter}
          onRefresh={fetchAssets}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={
            <Link
              to={mosqueFilter ? `${ROUTES.ASSETS.CREATE}?mosqueId=${mosqueFilter}` : ROUTES.ASSETS.CREATE}
            >
              <Button size="md" icon={<FiPlus />} collapseLabel>New Asset</Button>
            </Link>
          }
        />

        {isFilterVisible && (
          <div className="flex flex-wrap gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
            <select
              aria-label="Filter"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="in_use">In Use</option>
              <option value="under_maintenance">Under Maintenance</option>
              <option value="disposed">Disposed</option>
              <option value="damaged">Damaged</option>
            </select>
            <select
              aria-label="Filter"
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
            >
              <option value="">All Categories</option>
              <option value="furniture">Furniture</option>
              <option value="electronics">Electronics</option>
              <option value="vehicle">Vehicle</option>
              <option value="building">Building</option>
              <option value="land">Land</option>
              <option value="equipment">Equipment</option>
              <option value="other">Other</option>
            </select>
            <select
              aria-label="Filter"
              value={mosqueFilter}
              onChange={(e) => {
                setMosqueFilter(e.target.value);
                setCurrentPage(1);
                setSearchParams(e.target.value ? { mosqueId: e.target.value } : {});
              }}
              className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
            >
              <option value="">All Mosques</option>
              {mosques.map((m) => (
                <option key={m.id} value={m.id}>
                  {toTitleCase(m.name)}
                </option>
              ))}
            </select>
            {(statusFilter || categoryFilter || mosqueFilter) && (
              <button
                onClick={() => {
                  setStatusFilter('');
                  setCategoryFilter('');
                  setMosqueFilter('');
                  setCurrentPage(1);
                  setSearchParams({});
                }}
                className="px-3 py-2 text-sm text-red-600 hover:text-red-700 dark:text-red-400"
              >
                Clear Filters
              </button>
            )}
          </div>
        )}

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchAssets} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <Table
            fixedLayout
            striped
            columns={columns}
            data={assets}
            emptyMessage="No assets found"
            showExport={false}
            onRowClick={(row) => navigate(ROUTES.ASSETS.DETAIL(row.id))}
          />
        )}

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
          setSelectedAsset(null);
        }}
        title="Delete Asset"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedAsset(null);
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
          Are you sure you want to delete <strong>{toTitleCase(selectedAsset?.name)}</strong>? This will also delete all
          maintenance records. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
