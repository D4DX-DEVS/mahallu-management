import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FiEdit, FiArrowLeft, FiMail, FiPhone, FiMapPin, FiGlobe, FiCalendar, FiTrash2 } from 'react-icons/fi';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { Tenant } from '@/types/tenant';
import { tenantService } from '@/services/tenantService';
import { formatDate, toTitleCase } from '@/utils/format';
import { loadErrorMessage, errorMessage } from '@/utils/errors';
import { toast } from '@/store/toastStore';
import { CLASSIFICATION_LABELS, TenantClassification } from '@/constants/modules';

export default function TenantDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!id) return;
    try {
      setDeleting(true);
      await tenantService.delete(id);
      toast.success('Tenant deleted');
      navigate('/admin/tenants');
    } catch (err) {
      toast.error(errorMessage(err, { action: 'delete tenant' }));
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadTenant();
    }
  }, [id]);

  const loadTenant = async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const data = await tenantService.getById(id!);
      setTenant(data);
    } catch (error) {
      console.error('Error loading tenant:', error);
      setLoadError(loadErrorMessage(error, 'tenant'));
    } finally {
      setIsLoading(false);
    }
  };

  const pageTitle = tenant?.name ? toTitleCase(tenant.name) : 'Tenant';
  const breadcrumbItems = [{ label: 'Tenants', path: '/admin/tenants' }];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title={pageTitle} breadcrumbs={breadcrumbItems} />
        <Card>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        </Card>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="space-y-4">
        <PageHeader title={pageTitle} breadcrumbs={breadcrumbItems} />
        <Card>
          <div className="text-center py-10">
            <p className="text-gray-500 dark:text-gray-400">{loadError || 'Tenant not found'}</p>
            <Button variant="outline" onClick={() => navigate('/admin/tenants')} className="mt-4">
              Back to Tenants
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title={pageTitle} breadcrumbs={breadcrumbItems} />

      {/* Header */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/admin/tenants')}
            className="flex flex-wrap items-center gap-2"
          >
            <FiArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <PageHeader title={toTitleCase(tenant.name)} description="Tenant Details" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link to={`/admin/tenants/${id}/edit`}>
            <Button variant="primary" className="flex items-center gap-2">
              <FiEdit className="h-4 w-4" />
              Edit Tenant
            </Button>
          </Link>
          <Button variant="danger" onClick={() => setShowDeleteModal(true)} className="flex items-center gap-2">
            <FiTrash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Status Badge */}
      <div>
        <span
          className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${
            tenant.status === 'active'
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : tenant.status === 'suspended'
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}
        >
          {tenant.status?.charAt(0).toUpperCase() + tenant.status?.slice(1)}
        </span>
      </div>

      {/* Basic Information */}
      <Card title="Basic Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <FiGlobe className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Tenant Name</p>
              <p className="font-medium text-gray-900 dark:text-white">{toTitleCase(tenant.name)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <FiGlobe className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Tenant Code</p>
              <p className="font-medium text-gray-900 dark:text-white">{tenant.code}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <FiMail className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Location</p>
              <p className="font-medium text-gray-900 dark:text-white">{tenant.location ? toTitleCase(tenant.location) : 'N/A'}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <FiPhone className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Type</p>
              <p className="font-medium text-gray-900 dark:text-white capitalize">{tenant.type}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <FiGlobe className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Mahallu Classification</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {CLASSIFICATION_LABELS[(tenant as any).classification as TenantClassification] ||
                  (tenant as any).classification ||
                  'N/A'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <FiCalendar className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Since</p>
              <p className="font-medium text-gray-900 dark:text-white">{formatDate(tenant.since)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <FiMapPin className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Address</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {tenant.address
                  ? `${toTitleCase(tenant.address.village)}, ${toTitleCase(tenant.address.lsgName)}, ${toTitleCase(tenant.address.district)}, ${toTitleCase(tenant.address.state)}${tenant.address.pinCode ? ` - ${tenant.address.pinCode}` : ''}`
                  : 'N/A'}
              </p>
            </div>
          </div>

          {tenant.address?.postOffice && (
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                <FiMapPin className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Post Office</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {toTitleCase(tenant.address.postOffice)}
                </p>
              </div>
            </div>
          )}

          {tenant.settings?.varisangyaAmount !== undefined && (
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                <FiGlobe className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Varisangya Amount</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {tenant.settings.varisangyaAmount}
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Subscription Information */}
      <Card title="Subscription Details">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <FiGlobe className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Plan</p>
              <p className="font-medium text-gray-900 dark:text-white capitalize">
                {tenant.subscription?.plan || 'N/A'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <FiCalendar className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {tenant.subscription?.isActive ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <FiCalendar className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Start Date</p>
              <p className="font-medium text-gray-900 dark:text-white">
                {formatDate(tenant.subscription?.startDate)}
              </p>
            </div>
          </div>

          {tenant.subscription?.endDate && (
            <div className="flex items-start gap-3">
              <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                <FiCalendar className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">End Date</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {formatDate(tenant.subscription.endDate)}
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* System Information */}
      <Card title="System Information">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <FiCalendar className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Created At</p>
              <p className="font-medium text-gray-900 dark:text-white">{formatDate(tenant.createdAt)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <FiCalendar className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Last Updated</p>
              <p className="font-medium text-gray-900 dark:text-white">{formatDate(tenant.updatedAt)}</p>
            </div>
          </div>
        </div>
      </Card>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Tenant"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          Are you sure you want to delete <strong>{toTitleCase(tenant.name)}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
