import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FiEdit, FiArrowLeft, FiMail, FiPhone, FiMapPin, FiGlobe, FiCalendar, FiUser } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import Avatar, { PersonCell } from '@/components/ui/Avatar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Tenant } from '@/types/tenant';
import { tenantService } from '@/services/tenantService';
import { formatDate } from '@/utils/format';

export default function TenantDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadTenant();
    }
  }, [id]);

  const loadTenant = async () => {
    try {
      setIsLoading(true);
      const data = await tenantService.getById(id!, { force: true });
      setTenant(data);
    } catch (error) {
      console.error('Error loading tenant:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner />
          </div>
        </Card>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="space-y-4">
        <Card>
          <div className="text-center py-12">
            <p className="text-[#7B8983] dark:text-surface-muted">Tenant not found</p>
            <Button
              variant="secondary"
              onClick={() => navigate('/admin/tenants')}
              className="mt-4"
            >
              Back to Tenants
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      <PageHeader
        title={tenant.name}
        leading={<Avatar size={56} name={tenant.name} />}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            Tenant Details
            <StatusBadge status={tenant.status} tone={tenant.status === 'suspended' ? 'warning' : undefined} />
          </span>
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate('/admin/tenants')}>
              <FiArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
            <Link to={`/admin/tenants/${id}/edit`}>
              <Button variant="primary">
                <FiEdit className="h-3.5 w-3.5" />
                Edit Tenant
              </Button>
            </Link>
          </>
        }
      />

      {/* Basic Information */}
      <Card>
        <h2 className="mb-3 text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">Basic Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-mint dark:bg-brand-lime/15">
              <FiGlobe className="h-4 w-4 text-primary-600 dark:text-brand-lime" />
            </div>
            <div>
              <p className="text-xs text-[#7B8983] dark:text-surface-muted">Tenant Name</p>
              <div className="mt-0.5"><PersonCell name={tenant.name} size={24} /></div>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-mint dark:bg-brand-lime/15">
              <FiGlobe className="h-4 w-4 text-primary-600 dark:text-brand-lime" />
            </div>
            <div>
              <p className="text-xs text-[#7B8983] dark:text-surface-muted">Tenant Code</p>
              <p className="text-[13px] font-semibold text-[#18231E] dark:text-surface-text">{tenant.code}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-mint dark:bg-brand-lime/15">
              <FiMail className="h-4 w-4 text-primary-600 dark:text-brand-lime" />
            </div>
            <div>
              <p className="text-xs text-[#7B8983] dark:text-surface-muted">Location</p>
              <p className="text-[13px] font-semibold text-[#18231E] dark:text-surface-text">{tenant.location || 'N/A'}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-mint dark:bg-brand-lime/15">
              <FiPhone className="h-4 w-4 text-primary-600 dark:text-brand-lime" />
            </div>
            <div>
              <p className="text-xs text-[#7B8983] dark:text-surface-muted">Type</p>
              <p className="mt-0.5">{tenant.type ? <StatusBadge status={tenant.type} tone="neutral" dot={false} /> : '-'}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-mint dark:bg-brand-lime/15">
              <FiCalendar className="h-4 w-4 text-primary-600 dark:text-brand-lime" />
            </div>
            <div>
              <p className="text-xs text-[#7B8983] dark:text-surface-muted">Since</p>
              <p className="text-[13px] font-semibold text-[#18231E] dark:text-surface-text">{formatDate(tenant.since)}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-mint dark:bg-brand-lime/15">
              <FiMapPin className="h-4 w-4 text-primary-600 dark:text-brand-lime" />
            </div>
            <div>
              <p className="text-xs text-[#7B8983] dark:text-surface-muted">Address</p>
              <p className="text-[13px] font-semibold text-[#18231E] dark:text-surface-text">
                {tenant.address ? `${tenant.address.village}, ${tenant.address.lsgName}, ${tenant.address.district}, ${tenant.address.state}${tenant.address.pinCode ? ` - ${tenant.address.pinCode}` : ''}` : 'N/A'}
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Subscription Information */}
      <Card>
        <h2 className="mb-3 text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">Subscription Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-mint dark:bg-brand-lime/15">
              <FiGlobe className="h-4 w-4 text-primary-600 dark:text-brand-lime" />
            </div>
            <div>
              <p className="text-xs text-[#7B8983] dark:text-surface-muted">Plan</p>
              <p className="mt-0.5"><StatusBadge status={tenant.subscription?.plan || 'N/A'} tone="info" dot={false} /></p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-mint dark:bg-brand-lime/15">
              <FiCalendar className="h-4 w-4 text-primary-600 dark:text-brand-lime" />
            </div>
            <div>
              <p className="text-xs text-[#7B8983] dark:text-surface-muted">Status</p>
              <p className="text-[13px] font-semibold text-[#18231E] dark:text-surface-text">
                {tenant.subscription?.isActive ? 'Active' : 'Inactive'}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-mint dark:bg-brand-lime/15">
              <FiCalendar className="h-4 w-4 text-primary-600 dark:text-brand-lime" />
            </div>
            <div>
              <p className="text-xs text-[#7B8983] dark:text-surface-muted">Start Date</p>
              <p className="text-[13px] font-semibold text-[#18231E] dark:text-surface-text">
                {formatDate(tenant.subscription?.startDate)}
              </p>
            </div>
          </div>

          {tenant.subscription?.endDate && (
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-mint dark:bg-brand-lime/15">
                <FiCalendar className="h-4 w-4 text-primary-600 dark:text-brand-lime" />
              </div>
              <div>
                <p className="text-xs text-[#7B8983] dark:text-surface-muted">End Date</p>
                <p className="text-[13px] font-semibold text-[#18231E] dark:text-surface-text">
                  {formatDate(tenant.subscription.endDate)}
                </p>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* System Information */}
      <Card>
        <h2 className="mb-3 text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">System Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-mint dark:bg-brand-lime/15">
              <FiCalendar className="h-4 w-4 text-primary-600 dark:text-brand-lime" />
            </div>
            <div>
              <p className="text-xs text-[#7B8983] dark:text-surface-muted">Created At</p>
              <p className="text-[13px] font-semibold text-[#18231E] dark:text-surface-text">
                {formatDate(tenant.createdAt)}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-mint dark:bg-brand-lime/15">
              <FiCalendar className="h-4 w-4 text-primary-600 dark:text-brand-lime" />
            </div>
            <div>
              <p className="text-xs text-[#7B8983] dark:text-surface-muted">Last Updated</p>
              <p className="text-[13px] font-semibold text-[#18231E] dark:text-surface-text">
                {formatDate(tenant.updatedAt)}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
