import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiAlertCircle, FiCheckCircle, FiEye, FiGlobe, FiPlus, FiTrash2, FiXCircle } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import { rowActionClass } from '@/components/ui/rowAction';
import FilterPanel from '@/components/ui/FilterPanel';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import TableToolbar from '@/components/ui/TableToolbar';
import Pagination from '@/components/ui/Pagination';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { Tenant } from '@/types/tenant';
import { tenantService } from '@/services/tenantService';
import { fetchAllPages } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/utils/format';
import { useDebounce } from '@/hooks/useDebounce';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

export default function TenantsList() {
  const { isSuperAdmin } = useAuthStore();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [showSuspendModal, setShowSuspendModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const debouncedSearch = useDebounce(searchQuery, 500);

  // A new search/filter invalidates the current page offset
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter]);

  useEffect(() => {
    if (isSuperAdmin) {
      loadTenants();
    }
  }, [isSuperAdmin, statusFilter, debouncedSearch, currentPage, itemsPerPage]);

  const loadTenants = async () => {
    try {
      setIsLoading(true);
      const params: any = { page: currentPage, limit: itemsPerPage };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const response = await tenantService.getAll(params);
      setTenants(response.data || []);
      setPagination(response.pagination);
    } catch (error) {
      console.error('Error loading tenants:', error);
      setTenants([]);
      setPagination(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const dataToExport = await fetchAllPages((pageParams) =>
        tenantService.getAll({ ...params, ...pageParams })
      );
      if (dataToExport.length === 0) {
        toast.info('No data to export');
        return;
      }
      const filename = 'tenants';
      const title = 'All Tenants';
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

  // Search is applied server-side via the `search` param — filtering again here
  // would drop rows the server already matched on other fields.

  const handleSuspend = async () => {
    if (selectedTenant) {
      const name = toTitleCase(selectedTenant.name);
      try {
        await tenantService.suspend(selectedTenant.id);
        await loadTenants();
        setShowSuspendModal(false);
        setSelectedTenant(null);
        toast.success(`${name} suspended`);
      } catch (error: any) {
        toast.error(errorMessage(error, { action: `suspend ${name}` }));
      }
    }
  };

  const handleActivate = async (tenant: Tenant) => {
    try {
      await tenantService.activate(tenant.id);
      await loadTenants();
      toast.success(`${toTitleCase(tenant.name)} activated`);
    } catch (error: any) {
      toast.error(errorMessage(error, { action: `activate ${toTitleCase(tenant.name)}` }));
    }
  };

  const handleDelete = async () => {
    if (selectedTenant) {
      const name = toTitleCase(selectedTenant.name);
      try {
        await tenantService.delete(selectedTenant.id);
        await loadTenants();
        setShowDeleteModal(false);
        setSelectedTenant(null);
        toast.success(`${name} deleted`);
      } catch (error: any) {
        toast.error(errorMessage(error, { action: `delete ${name}` }));
      }
    }
  };

  const columns: TableColumn<Tenant>[] = [
    {
      key: 'name',
      label: 'Tenant Name',
      width: '10.25rem',
      sortable: true,
      render: (value) => <span>{toTitleCase(value)}</span>,
    },
    { key: 'code', label: 'Code', width: '6.25rem' },
    {
      key: 'type',
      label: 'Type',
      width: '6.25rem',
      render: (type) => (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          {type}
        </span>
      ),
    },
    { key: 'location', label: 'Location', width: '8rem', render: (location) => toTitleCase(location) },
    {
      key: 'userCount',
      label: 'Users',
      width: '8.5rem',
      align: 'center',
      render: (count) => (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
          {count ?? 0}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '7.25rem',
      render: (status) => (
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            status === 'active'
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : status === 'suspended'
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}
        >
          {status}
        </span>
      ),
    },
    {
      key: 'since',
      label: 'Since',
      width: '6.5rem',
      render: (since) => formatDate(since),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '8rem',
      align: 'center',
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/admin/tenants/${row.id}`);
            }}
            className={rowActionClass()}
            title="View Details"
            aria-label="View Details"
          >
            <FiEye className="h-4 w-4" />
          </button>
          {row.status === 'active' ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setSelectedTenant(row);
                setShowSuspendModal(true);
              }}
              className={rowActionClass('warning')}
              title="Suspend"
              aria-label="Suspend"
            >
              <FiXCircle className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleActivate(row);
              }}
              className={rowActionClass()}
              title="Activate"
              aria-label="Activate"
            >
              <FiCheckCircle className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedTenant(row);
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
      title: 'Total Tenants',
      // ponytail: total from server; Active/Suspended still count the current page
      value: pagination?.total ?? tenants.length,
      icon: <FiGlobe className="h-5 w-5" />,
    },
    {
      title: 'Active Tenants',
      value: tenants.filter((t) => t.status === 'active').length,
      icon: <FiCheckCircle className="h-5 w-5" />,
    },
    {
      title: 'Suspended',
      value: tenants.filter((t) => t.status === 'suspended').length,
      icon: <FiAlertCircle className="h-5 w-5" />,
    },
  ];

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500 dark:text-gray-400">Super admin access required</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <PageHeader title="Tenants Management" description="Manage all tenants (Mahalls) in the system" />

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      {/* Actions and Table */}
      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
          isFilterVisible={isFilterVisible}
          hasFilters={true}
          onRefresh={loadTenants}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={
            <Link to="/admin/tenants/create">
              <Button size="md" icon={<FiPlus />} collapseLabel>New Tenant</Button>
            </Link>
          }
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-40">
              <Select
                options={[
                  { value: 'all', label: 'All Status' },
                  { value: 'active', label: 'Active' },
                  { value: 'suspended', label: 'Suspended' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
            </div>
          </FilterPanel>
        )}

        <Table
          fixedLayout
          striped
          columns={columns}
          data={tenants}
          isLoading={isLoading}
          emptyMessage="No tenants found"
          showExport={false}
        />
        {pagination && pagination.totalPages > 1 && (
          <div className="mt-4">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={setCurrentPage}
              onItemsPerPageChange={(items) => {
                setItemsPerPage(items);
                setCurrentPage(1);
              }}
            />
          </div>
        )}
      </TableCard>

      {/* Suspend Modal */}
      <Modal
        isOpen={showSuspendModal}
        onClose={() => {
          setShowSuspendModal(false);
          setSelectedTenant(null);
        }}
        title="Suspend Tenant"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowSuspendModal(false);
                setSelectedTenant(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleSuspend}>
              Suspend Tenant
            </Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          Are you sure you want to suspend <strong>{toTitleCase(selectedTenant?.name)}</strong>? This will prevent all
          users from accessing this tenant.
        </p>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedTenant(null);
        }}
        title="Delete Tenant"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedTenant(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete Tenant
            </Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          Are you sure you want to delete <strong>{toTitleCase(selectedTenant?.name)}</strong>? This action cannot be
          undone and will delete all associated data.
        </p>
      </Modal>
    </div>
  );
}
