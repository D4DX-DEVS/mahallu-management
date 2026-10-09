import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { FiAlertTriangle, FiCheckCircle, FiEdit2, FiEye, FiPackage, FiPlus, FiTrash2, FiXCircle } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import FilterPanel from '@/components/ui/FilterPanel';
import Select from '@/components/ui/Select';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
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
import { useServerCounts } from '@/hooks/useServerCounts';
import ActionsMenu from '@/components/ui/ActionsMenu';
import { toTitleCase } from '@/utils/format';
import { logError } from '@/utils/safeLog';

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
  const [itemsPerPage, setItemsPerPage] = useState(25);
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
  }, [debouncedSearch, currentPage, itemsPerPage, statusFilter, categoryFilter, mosqueFilter]);

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
      logError('Error fetching assets', err);
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
    if (!selectedAsset) return;
    try {
      setDeleting(true);
      await assetService.delete(selectedAsset.id);
      await fetchAssets();
      setShowDeleteModal(false);
      setSelectedAsset(null);
      toast.success('Asset deleted');
    } catch (err: any) {
      /* A failed delete used to reuse the page-level `error` state, which also
       * drives the table-vs-error-box branch below — so a delete failure made
       * the whole list disappear behind a full-page error instead of just
       * failing the one action. */
      toast.error(errorMessage(err, { action: 'delete asset' }));
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn<Asset>[] = [
    {
      key: 'name',
      label: 'Name',
      width: '14rem',
      sortable: true,
      render: (value) => <span className="font-medium text-foreground">{toTitleCase(value)}</span>,
    },
    {
      key: 'category',
      label: 'Category',
      width: '9rem',
      priority: 'secondary',
      render: (category) => categoryLabels[category] || category,
    },
    {
      key: 'mosqueId',
      label: 'Mosque',
      width: '10rem',
      priority: 'secondary',
      render: (value) => (
        <span>{toTitleCase(typeof value === 'object' && value ? value.name : mosqueName(value) || '-')}</span>
      ),
    },
    {
      key: 'estimatedValue',
      label: 'Value (₹)',
      width: '8rem',
      align: 'right',
      render: (value) => value?.toLocaleString('en-IN') || '0',
    },
    {
      key: 'purchaseDate',
      label: 'Purchase date',
      width: '9rem',
      priority: 'tertiary',
      render: (date) => formatDate(date),
    },
    {
      key: 'status',
      label: 'Status',
      width: '8rem',
      render: (status) => <StatusBadge status={status} />,
    },
    {
      key: 'actions',
      label: '',
      width: '6.5rem',
      align: 'right',
      sortable: false,
      render: (_, row) => (
        <ActionsMenu
          label={`Actions for ${toTitleCase(row.name)}`}
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

  // Whole-list counts from the server: these cards used to count only the rows on this page.
  const countBase: { search?: string; category?: string; mosqueId?: string } = {};
  if (debouncedSearch) countBase.search = debouncedSearch;
  if (categoryFilter) countBase.category = categoryFilter;
  if (mosqueFilter) countBase.mosqueId = mosqueFilter;
  const countOf = (status: string) => assetService.getAll({ ...countBase, status, page: 1, limit: 1 });
  const statusCounts = useServerCounts(
    {
      active: () => countOf('active'),
      inUse: () => countOf('in_use'),
      maintenance: () => countOf('under_maintenance'),
      disposed: () => countOf('disposed'),
      damaged: () => countOf('damaged'),
    },
    [assets]
  );
  const sumCounts = (...values: (number | undefined)[]) =>
    values.every((v) => v !== undefined) ? values.reduce<number>((sum, v) => sum + (v as number), 0) : undefined;

  const stats = [
    {
      title: 'Total Assets',
      value: pagination?.total || assets.length,
      icon: <FiPackage className="h-5 w-5" />,
    },
    {
      title: 'Active',
      value: sumCounts(statusCounts.active, statusCounts.inUse) ?? assets.filter((a) => a.status === 'active' || a.status === 'in_use').length,
      icon: <FiCheckCircle className="h-5 w-5" />,
    },
    {
      title: 'Under Maintenance',
      value: statusCounts.maintenance ?? assets.filter((a) => a.status === 'under_maintenance').length,
      icon: <FiAlertTriangle className="h-5 w-5" />,
    },
    {
      title: 'Disposed / Damaged',
      value: sumCounts(statusCounts.disposed, statusCounts.damaged) ?? assets.filter((a) => a.status === 'disposed' || a.status === 'damaged').length,
      icon: <FiXCircle className="h-5 w-5" />,
    },
  ];

  const activeFilterCount = [statusFilter, categoryFilter, mosqueFilter].filter(Boolean).length;
  const isFiltered = Boolean(debouncedSearch) || activeFilterCount > 0;
  const clearFilters = () => {
    setStatusFilter('');
    setCategoryFilter('');
    setMosqueFilter('');
    setCurrentPage(1);
    setSearchParams({});
  };

  return (
    <>
      <PageHeader
        title="Assets"
        description="Manage your mahallu assets."
        actions={
          <Link to={mosqueFilter ? `${ROUTES.ASSETS.CREATE}?mosqueId=${mosqueFilter}` : ROUTES.ASSETS.CREATE}>
            <Button icon={<FiPlus />} collapseLabel>New asset</Button>
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchEntity="assets"
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={activeFilterCount}
          onRefresh={fetchAssets}
          onExport={handleExport}
          isExporting={isExporting}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-48">
              <Select
                label="Status"
                options={[
                  { value: '', label: 'All statuses' },
                  { value: 'active', label: 'Active' },
                  { value: 'in_use', label: 'In use' },
                  { value: 'under_maintenance', label: 'Under maintenance' },
                  { value: 'disposed', label: 'Disposed' },
                  { value: 'damaged', label: 'Damaged' },
                ]}
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="w-full sm:w-48">
              <Select
                label="Category"
                options={[
                  { value: '', label: 'All categories' },
                  { value: 'furniture', label: 'Furniture' },
                  { value: 'electronics', label: 'Electronics' },
                  { value: 'vehicle', label: 'Vehicle' },
                  { value: 'building', label: 'Building' },
                  { value: 'land', label: 'Land' },
                  { value: 'equipment', label: 'Equipment' },
                  { value: 'other', label: 'Other' },
                ]}
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="w-full sm:w-52">
              <Select
                label="Mosque"
                options={[
                  { value: '', label: 'All mosques' },
                  ...mosques.map((m) => ({ value: m.id, label: toTitleCase(m.name) })),
                ]}
                value={mosqueFilter}
                onChange={(e) => {
                  setMosqueFilter(e.target.value);
                  setCurrentPage(1);
                  setSearchParams(e.target.value ? { mosqueId: e.target.value } : {});
                }}
              />
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </FilterPanel>
        )}

        {error ? (
          <EmptyState variant="error" entity="assets" description={error} action={{ label: 'Try again', onClick: fetchAssets }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={assets}
              isLoading={loading}
              entity="assets"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); clearFilters(); } }
                  : { label: 'Add asset', onClick: () => navigate(ROUTES.ASSETS.CREATE) }
              }
              onRowClick={(row) => navigate(ROUTES.ASSETS.DETAIL(row.id))}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="assets"
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
        title={`Delete ${selectedAsset?.name ? toTitleCase(selectedAsset.name) : 'this asset'}?`}
        message="This permanently removes the asset and cannot be undone."
        consequence="Its maintenance records will be deleted too."
        confirmLabel="Delete asset"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setShowDeleteModal(false);
          setSelectedAsset(null);
        }}
      />
    </>
  );
}
