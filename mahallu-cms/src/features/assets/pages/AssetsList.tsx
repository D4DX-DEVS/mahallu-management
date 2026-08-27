import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FiEdit2, FiTrash2, FiEye, FiPackage, FiCheckCircle, FiAlertTriangle, FiXCircle } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
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
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';

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

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  in_use: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  under_maintenance: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  disposed: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
  damaged: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
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
      const params: any = { limit: 10000 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category = categoryFilter;

      const result = await assetService.getAll(params);
      const dataToExport = result.data;

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
      toast.error(error?.response?.data?.message || 'Failed to export data');
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
      setError(err.response?.data?.message || 'Failed to delete asset');
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn<Asset>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'name', label: 'Name', sortable: true },
    {
      key: 'category',
      label: 'Category',
      render: (category) => categoryLabels[category] || category,
    },
    {
      key: 'mosqueId',
      label: 'Mosque',
      render: (value) => (typeof value === 'object' && value ? value.name : mosqueName(value) || '-'),
    },
    {
      key: 'estimatedValue',
      label: 'Value (₹)',
      render: (value) => value?.toLocaleString('en-IN') || '0',
    },
    {
      key: 'purchaseDate',
      label: 'Purchase Date',
      render: (date) => formatDate(date),
    },
    {
      key: 'status',
      label: 'Status',
      render: (status) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[status] || 'bg-gray-100 text-gray-800'}`}>
          {statusLabels[status] || status}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(ROUTES.ASSETS.DETAIL(row.id));
            }}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            title="View"
          >
            <FiEye className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(ROUTES.ASSETS.EDIT(row.id));
            }}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            title="Edit"
          >
            <FiEdit2 className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedAsset(row);
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
    { title: 'Total Assets', value: pagination?.total || assets.length, icon: <FiPackage className="h-5 w-5" /> },
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Asset Management</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Manage your mahallu assets</p>
          </div>
          <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Assets' }]} />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
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
          hasFilters={!!statusFilter || !!categoryFilter || !!mosqueFilter}
          onRefresh={fetchAssets}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={
            <Link to={mosqueFilter ? `${ROUTES.ASSETS.CREATE}?mosqueId=${mosqueFilter}` : ROUTES.ASSETS.CREATE}>
              <Button size="md">
                + New Asset
              </Button>
            </Link>
          }
        />

        {isFilterVisible && (
          <div className="flex flex-wrap gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
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
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
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
                  {m.name}
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
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchAssets} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <Table
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
      </Card>

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
          Are you sure you want to delete <strong>{selectedAsset?.name}</strong>? This will also delete all maintenance records. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
