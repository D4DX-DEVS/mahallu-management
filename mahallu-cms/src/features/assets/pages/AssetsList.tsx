import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiPackage, FiCheckCircle, FiAlertTriangle, FiXCircle, FiRefreshCw, FiDownload, FiFileText, FiFile } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { Asset } from '@/types';
import { ROUTES } from '@/constants/routes';
import { assetService } from '@/services/assetService';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import type { BadgeVariant } from '@/components/ui/Badge';
import PageHeader from '@/components/ui/PageHeader';
import { controlClasses } from '@/components/ui/Input';
import FilterBar from '@/components/ui/FilterBar';
import StatusBadge from '@/components/ui/StatusBadge';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import Dropdown from '@/components/ui/Dropdown';
import { useUndoableAction } from '@/hooks/useUndoableAction';
import { shareViz } from '@/utils/statSeries';

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

const statusTones: Record<string, BadgeVariant> = {
  active: 'success',
  in_use: 'info',
  under_maintenance: 'warning',
  disposed: 'neutral',
  damaged: 'danger',
};

export default function AssetsList() {
  const undo = useUndoableAction('asset');
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [assets, setAssets] = useState<Asset[]>([]);
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

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchAssets();
  }, [debouncedSearch, currentPage, statusFilter, categoryFilter]);

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
        toast.info('Nothing to export. Change your filters and try again.');
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
      toast.error(getFriendlyError(error, "Couldn't export data. Check your connection and try again."));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedAsset) return;
    const target = selectedAsset;
    setShowDeleteModal(false);
    setSelectedAsset(null);
    // Confirmed first (cascades to maintenance records); the API call itself waits out the undo window
    undo.run({
      id: target.id,
      label: `${target.name || 'Asset'} deleted`,
      commit: () => assetService.delete(target.id),
      onCommitted: fetchAssets,
      errorMessage: "Couldn't delete the asset. Try again in a moment.",
    });
  };

  const columns: TableColumn<Asset>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'name', label: 'Name', sortable: true, render: (name) => <PersonCell name={name} /> },
    {
      key: 'category',
      label: 'Category',
      render: (category) => (category ? <StatusBadge status={category} label={categoryLabels[category] || String(category)} tone="neutral" dot={false} /> : '-'),
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
        <StatusBadge status={status} tone={statusTones[status] ?? 'neutral'} label={statusLabels[status] || status} />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <RowActions
          onView={() => navigate(ROUTES.ASSETS.DETAIL(row.id))}
          onEdit={() => navigate(ROUTES.ASSETS.EDIT(row.id))}
          onDelete={() => {
            setSelectedAsset(row);
            setShowDeleteModal(true);
          }}
          deleteLabel="Delete"
          ariaLabels={{ view: 'View asset', edit: 'Edit asset', delete: 'Delete asset' }}
        />
      ),
    },
  ];

  const stats = [
    { title: 'Total Assets', value: pagination?.total || assets.length, icon: <FiPackage className="h-[17px] w-[17px]" />,
      tone: 'green' as const },
    {
      title: 'Active',
      value: assets.filter((a) => a.status === 'active' || a.status === 'in_use').length, viz: shareViz(assets.filter((a) => a.status === 'active' || a.status === 'in_use').length, assets.length), summary: `Active: ${assets.filter((a) => a.status === 'active' || a.status === 'in_use').length} of ${assets.length}`,
      icon: <FiCheckCircle className="h-[17px] w-[17px]" />,
      tone: 'lime' as const,
    },
    {
      title: 'Under Maintenance',
      value: assets.filter((a) => a.status === 'under_maintenance').length, viz: shareViz(assets.filter((a) => a.status === 'under_maintenance').length, assets.length), summary: `Under Maintenance: ${assets.filter((a) => a.status === 'under_maintenance').length} of ${assets.length}`,
      icon: <FiAlertTriangle className="h-[17px] w-[17px]" />,
      tone: 'neutral' as const,
    },
    {
      title: 'Disposed / Damaged',
      value: assets.filter((a) => a.status === 'disposed' || a.status === 'damaged').length, viz: shareViz(assets.filter((a) => a.status === 'disposed' || a.status === 'damaged').length, assets.length), summary: `Disposed / Damaged: ${assets.filter((a) => a.status === 'disposed' || a.status === 'damaged').length} of ${assets.length}`,
      icon: <FiXCircle className="h-[17px] w-[17px]" />,
      tone: 'neutral' as const,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Asset Management"
        description="Manage your mahallu assets"
        actions={
          <Link to={ROUTES.ASSETS.CREATE}>
            <Button>+ New Asset</Button>
          </Link>
        }
      />

<div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          {stats.map((stat, index) => (
            <StatCard key={index} variant="inline" {...stat} />
          ))}
        </div>

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search assets' }}
          actions={
            <>
              <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={fetchAssets}>
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
          <div className="w-44">
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className={`${controlClasses} h-[34px] text-xs`}
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="in_use">In Use</option>
              <option value="under_maintenance">Under Maintenance</option>
              <option value="disposed">Disposed</option>
              <option value="damaged">Damaged</option>
            </select>
          </div>
          <div className="w-40">
            <select
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
              className={`${controlClasses} h-[34px] text-xs`}
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
          </div>
          {(statusFilter || categoryFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setStatusFilter(''); setCategoryFilter(''); setCurrentPage(1); }}
            >
              Clear filters
            </Button>
          )}
        </FilterBar>

        <div className="p-3.5">

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchAssets} className="mt-4" variant="secondary">
              Retry
            </Button>
          </div>
        ) : (
          <Table
            columns={columns}
            data={undo.filterHidden(assets, (a) => a.id)}
            emptyMessage="No assets found"
            showExport={false}
            onRowClick={(row) => navigate(ROUTES.ASSETS.DETAIL(row.id))}
          />
        )}

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
          setSelectedAsset(null);
        }}
        title="Delete asset?"
        footer={
          <>
            <Button
              variant="secondary"
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
        <p className="text-[#5B6963] dark:text-surface-muted">
          Delete <strong>{selectedAsset?.name}</strong>? This will also delete all maintenance records. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
