import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiXCircle, FiGlobe, FiAlertCircle, FiRefreshCw, FiDownload, FiFileText, FiFile } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import { TableColumn } from '@/types';
import { Tenant } from '@/types/tenant';
import { tenantService } from '@/services/tenantService';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/utils/format';
import { useDebounce } from '@/hooks/useDebounce';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import StatusBadge from '@/components/ui/StatusBadge';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import Dropdown from '@/components/ui/Dropdown';
import { monthlySeries, shareViz } from '@/utils/statSeries';

export default function TenantsList() {
  const { isSuperAdmin } = useAuthStore();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
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
      if (dataToExport.length === 0) { toast.info('Nothing to export. Change your filters and try again.'); return; }
      const filename = 'tenants';
      const title = 'All Tenants';
      switch (type) {
        case 'csv': exportToCSV(columns, dataToExport, filename); break;
        case 'json': exportToJSON(columns, dataToExport, filename); break;
        case 'pdf': exportToPDF(columns, dataToExport, filename, title); break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(getFriendlyError(error, "Couldn't export data. Check your connection and try again."));
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
        toast.error(getFriendlyError(error, `Couldn't suspend ${name}. Try again in a moment.`));
      }
    }
  };

  const handleActivate = async (tenant: Tenant) => {
    try {
      await tenantService.activate(tenant.id);
      await loadTenants();
      toast.success(`${tenant.name} activated`);
    } catch (error: any) {
      toast.error(getFriendlyError(error, `Couldn't activate ${tenant.name}. Try again in a moment.`));
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
        toast.error(getFriendlyError(error, `Couldn't delete ${name}. Try again in a moment.`));
      }
    }
  };

  const columns: TableColumn<Tenant>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'name', label: 'Tenant Name', sortable: true, render: (name) => <PersonCell name={name} /> },
    { key: 'code', label: 'Code' },
    {
      key: 'type',
      label: 'Type',
      render: (type) => (
        <StatusBadge status={type} tone="info" dot={false} />
      ),
    },
    { key: 'location', label: 'Location' },
    {
      key: 'userCount',
      label: 'Users',
      render: (count) => (
        <StatusBadge status={String(count ?? 0)} tone="neutral" dot={false} />
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (status) => (
        <StatusBadge status={status} tone={status === 'suspended' ? 'warning' : undefined} />
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
        <RowActions
          onView={() => navigate(`/admin/tenants/${row.id}`)}
          viewLabel="View details"
          onDelete={() => {
            setSelectedTenant(row);
            setShowDeleteModal(true);
          }}
          deleteLabel="Delete"
          extra={[
            row.status === 'active'
              ? {
                  label: 'Suspend',
                  icon: <FiXCircle />,
                  onClick: () => {
                    setSelectedTenant(row);
                    setShowSuspendModal(true);
                  },
                }
              : { label: 'Activate', icon: <FiCheckCircle />, onClick: () => handleActivate(row) },
          ]}
        />
      ),
    },
  ];

  const stats = [
    {
      title: 'Total Tenants',
      value: tenants.length, viz: monthlySeries(tenants as any[], (r: any) => r.createdAt).length ? { type: 'bars' as const, values: monthlySeries(tenants as any[], (r: any) => r.createdAt) } : undefined,
      icon: <FiGlobe className="h-[17px] w-[17px]" />,
      tone: 'green' as const,
    },
    {
      title: 'Active Tenants',
      value: tenants.filter((t) => t.status === 'active').length, viz: shareViz(tenants.filter((t) => t.status === 'active').length, tenants.length), summary: `Active Tenants: ${tenants.filter((t) => t.status === 'active').length} of ${tenants.length}`,
      icon: <FiCheckCircle className="h-[17px] w-[17px]" />,
      tone: 'lime' as const,
    },
    {
      title: 'Suspended',
      value: tenants.filter((t) => t.status === 'suspended').length, viz: shareViz(tenants.filter((t) => t.status === 'suspended').length, tenants.length), summary: `Suspended: ${tenants.filter((t) => t.status === 'suspended').length} of ${tenants.length}`,
      icon: <FiAlertCircle className="h-[17px] w-[17px]" />,
      tone: 'neutral' as const,
    },
  ];

  if (!isSuperAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-[#7B8983] dark:text-surface-muted">
          Super admin access required
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Tenants Management"
        description="Manage all tenants (Mahalls) in the system"
        actions={
          <Link to="/admin/tenants/create">
            <Button>+ New Tenant</Button>
          </Link>
        }
      />

{/* Statistics Cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <StatCard key={index} variant="inline" {...stat} />
          ))}
        </div>

      {/* Actions and Table */}
      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search tenants' }}
          actions={
            <>
              <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={loadTenants}>
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
          <div className="w-40">
            <Select
              aria-label="Filter by status"
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
        </FilterBar>

        <div className="p-3.5">

        <Table
          columns={columns}
          data={filteredTenants}
          isLoading={isLoading}
          emptyMessage="No tenants found"
          showExport={false}
        />
        </div>
      </Card>

      {/* Suspend Modal */}
      <Modal
        isOpen={showSuspendModal}
        onClose={() => {
          setShowSuspendModal(false);
          setSelectedTenant(null);
        }}
        title="Suspend tenant?"
        footer={
          <>
            <Button
              variant="secondary"
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
        <p className="text-[#5B6963] dark:text-surface-muted">
          Suspend <strong>{selectedTenant?.name}</strong>? This will prevent all users from accessing this tenant.
        </p>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedTenant(null);
        }}
        title="Delete tenant?"
        footer={
          <>
            <Button
              variant="secondary"
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
        <p className="text-[#5B6963] dark:text-surface-muted">
          Delete <strong>{selectedTenant?.name}</strong>? This cannot be undone and will delete all associated data.
        </p>
      </Modal>
    </div>
  );
}

