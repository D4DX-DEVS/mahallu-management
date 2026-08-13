import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiTrash2, FiCheckCircle, FiXCircle, FiEye, FiX, FiGlobe, FiAlertCircle } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn } from '@/types';
import { Tenant } from '@/types/tenant';
import { tenantService } from '@/services/tenantService';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/utils/format';
import { useDebounce } from '@/hooks/useDebounce';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';

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

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    if (isSuperAdmin) {
      loadTenants();
    }
  }, [isSuperAdmin, statusFilter, debouncedSearch]);

  const loadTenants = async () => {
    try {
      setIsLoading(true);
      const params: any = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const response = await tenantService.getAll(params);
      setTenants(response.data || []);
    } catch (error) {
      console.error('Error loading tenants:', error);
      setTenants([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      const params: any = { limit: 10000 };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const response = await tenantService.getAll(params);
      const dataToExport = response.data || [];
      if (dataToExport.length === 0) { toast.info('No data to export'); return; }
      const filename = 'tenants';
      const title = 'All Tenants';
      switch (type) {
        case 'csv': exportToCSV(columns, dataToExport, filename); break;
        case 'json': exportToJSON(columns, dataToExport, filename); break;
        case 'pdf': exportToPDF(columns, dataToExport, filename, title); break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error?.response?.data?.message || 'Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const filteredTenants = tenants.filter((tenant) =>
    tenant.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tenant.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tenant.location?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSuspend = async () => {
    if (selectedTenant) {
      const name = selectedTenant.name;
      try {
        await tenantService.suspend(selectedTenant.id);
        await loadTenants();
        setShowSuspendModal(false);
        setSelectedTenant(null);
        toast.success(`${name} suspended`);
      } catch (error: any) {
        toast.error(error.response?.data?.message || `Failed to suspend ${name}`);
      }
    }
  };

  const handleActivate = async (tenant: Tenant) => {
    try {
      await tenantService.activate(tenant.id);
      await loadTenants();
      toast.success(`${tenant.name} activated`);
    } catch (error: any) {
      toast.error(error.response?.data?.message || `Failed to activate ${tenant.name}`);
    }
  };

  const handleDelete = async () => {
    if (selectedTenant) {
      const name = selectedTenant.name;
      try {
        await tenantService.delete(selectedTenant.id);
        await loadTenants();
        setShowDeleteModal(false);
        setSelectedTenant(null);
        toast.success(`${name} deleted`);
      } catch (error: any) {
        toast.error(error.response?.data?.message || `Failed to delete ${name}`);
      }
    }
  };

  const columns: TableColumn<Tenant>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'name', label: 'Tenant Name', sortable: true },
    { key: 'code', label: 'Code' },
    {
      key: 'type',
      label: 'Type',
      render: (type) => (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
          {type}
        </span>
      ),
    },
    { key: 'location', label: 'Location' },
    {
      key: 'userCount',
      label: 'Users',
      render: (count) => (
        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
          {count ?? 0}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
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
      render: (since) => formatDate(since),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/admin/tenants/${row.id}`);
            }}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            title="View Details"
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
              className="p-1.5 rounded-md hover:bg-yellow-50 dark:hover:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400 transition-colors"
              title="Suspend"
            >
              <FiXCircle className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleActivate(row);
              }}
              className="p-1.5 rounded-md hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400 transition-colors"
              title="Activate"
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
    {
      title: 'Total Tenants',
      value: tenants.length,
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
        <p className="text-gray-500 dark:text-gray-400">
          Super admin access required
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              Tenants Management
            </h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
              Manage all tenants (Mahalls) in the system
            </p>
          </div>
          <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Tenants Management' }]} />
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      {/* Actions and Table */}
      <Card>
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
              <Button size="md">+ New Tenant</Button>
            </Link>
          }
        />

        {isFilterVisible && (
          <div className="relative flex flex-wrap items-center gap-4 mb-6 p-4 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700">
            <button
              onClick={() => setIsFilterVisible(false)}
              className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <FiX className="h-4 w-4" />
            </button>
            <div className="w-40">
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
          </div>
        )}

        <Table
          columns={columns}
          data={filteredTenants}
          isLoading={isLoading}
          emptyMessage="No tenants found"
          showExport={false}
        />
      </Card>

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
          Are you sure you want to suspend <strong>{selectedTenant?.name}</strong>? This will prevent all users from accessing this tenant.
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
          Are you sure you want to delete <strong>{selectedTenant?.name}</strong>? This action cannot be undone and will delete all associated data.
        </p>
      </Modal>
    </div>
  );
}

