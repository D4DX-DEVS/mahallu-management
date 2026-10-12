import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiSave, FiArrowLeft } from 'react-icons/fi';
import Alert from '@/components/ui/Alert';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Tenant } from '@/types/tenant';
import { tenantService } from '@/services/tenantService';
import { CLASSIFICATION_OPTIONS, TenantClassification } from '@/constants/modules';
import ModuleFeatureToggles from '../components/ModuleFeatureToggles';
import PageHeader from '@/components/ui/PageHeader';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

export default function EditTenant() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    nameMl: '',
    code: '',
    location: '',
    locationMl: '',
    type: 'standard' as 'standard' | 'premium' | 'enterprise',
    classification: 'fully_functional' as TenantClassification,
    features: {} as Record<string, boolean>,
    status: 'active' as 'active' | 'suspended' | 'inactive',
    address: {
      state: '',
      district: '',
      pinCode: '',
      postOffice: '',
      lsgName: '',
      village: '',
    },
  });

  useEffect(() => {
    if (id) {
      loadTenant();
    }
  }, [id]);

  const loadTenant = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const tenant = await tenantService.getById(id!, { force: true });
      setFormData({
        name: tenant.name || '',
        nameMl: tenant.nameMl || '',
        code: tenant.code || '',
        location: tenant.location || '',
        locationMl: tenant.locationMl || '',
        type: tenant.type || 'standard',
        classification: ((tenant as any).classification || 'fully_functional') as TenantClassification,
        features: ((tenant as any).settings?.features || {}) as Record<string, boolean>,
        status: tenant.status || 'active',
        address: {
          state: tenant.address?.state || '',
          district: tenant.address?.district || '',
          pinCode: tenant.address?.pinCode || '',
          postOffice: tenant.address?.postOffice || '',
          lsgName: tenant.address?.lsgName || '',
          village: tenant.address?.village || '',
        },
      });
    } catch (error: any) {
      console.error('Error loading tenant:', error);
      setError(getFriendlyError(error, "Couldn't load tenant. Refresh the page or try again."));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSaving(true);
      setError(null);
      const { features, ...rest } = formData;
      await tenantService.update(id!, { ...rest, settings: { features } } as any);
      navigate(`/admin/tenants/${id}`);
    } catch (error: any) {
      console.error('Error updating tenant:', error);
      toast.error(getFriendlyError(error, "Couldn't update tenant. Try again in a moment."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    if (field.startsWith('address.')) {
      const addressField = field.split('.')[1];
      setFormData((prev) => ({
        ...prev,
        address: { ...prev.address, [addressField]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }));
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

  if (error) {
    return (
      <div className="space-y-4">
        <Card>
          <div className="text-center py-12">
            <p className="text-[#B3261E] dark:text-red-300 mb-4">{error}</p>
            <Button
              variant="secondary"
              onClick={() => navigate('/admin/tenants')}
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
        title="Edit Tenant"
        description="Update tenant information"
        actions={
          <Button variant="secondary" onClick={() => navigate(`/admin/tenants/${id}`)}>
            <FiArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
        }
      />

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}
          <Card>
            <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">Tenant information</h2>
            <p className="mb-3 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Name, code, type and status</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Tenant Name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Enter tenant name"
                required
              />

              <div className="hidden">
              <Input
                label="Tenant Name (Malayalam)"
                value={formData.nameMl}
                onChange={(e) => handleChange('nameMl', e.target.value)}
                placeholder="മഹല്ലിന്റെ പേര്"
                className="font-malayalam"
              />
              </div>

              <Input
                label="Tenant Code"
                value={formData.code}
                onChange={(e) => handleChange('code', e.target.value)}
                placeholder="Enter tenant code"
                required
              />

              <Input
                label="Location"
                value={formData.location}
                onChange={(e) => handleChange('location', e.target.value)}
                placeholder="Enter location"
                required
              />

              <div className="hidden">
              <Input
                label="Location (Malayalam)"
                value={formData.locationMl}
                onChange={(e) => handleChange('locationMl', e.target.value)}
                placeholder="സ്ഥലം"
                className="font-malayalam"
              />
              </div>

              <Select
                label="Type"
                value={formData.type}
                onChange={(e) => handleChange('type', e.target.value)}
                options={[
                  { value: 'standard', label: 'Standard' },
                  { value: 'premium', label: 'Premium' },
                  { value: 'enterprise', label: 'Enterprise' },
                ]}
                required
              />

              <Select
                label="Mahallu Classification"
                value={formData.classification}
                onChange={(e) => handleChange('classification', e.target.value)}
                options={[...CLASSIFICATION_OPTIONS]}
                required
              />

              <Select
                label="Status"
                value={formData.status}
                onChange={(e) => handleChange('status', e.target.value)}
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'suspended', label: 'Suspended' },
                  { value: 'inactive', label: 'Inactive' },
                ]}
                required
              />
            </div>
          </Card>

          <ModuleFeatureToggles
            value={formData.features}
            onChange={(features) => setFormData((prev) => ({ ...prev, features }))}
          />

          {/* Address Section */}
          <Card>
              <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">Address details</h2>
              <p className="mb-3 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Where this tenant is located</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Village"
                  value={formData.address.village}
                  onChange={(e) => handleChange('address.village', e.target.value)}
                  placeholder="Enter village"
                />

                <Input
                  label="LSG Name"
                  value={formData.address.lsgName}
                  onChange={(e) => handleChange('address.lsgName', e.target.value)}
                  placeholder="Enter LSG name"
                />

                <Input
                  label="District"
                  value={formData.address.district}
                  onChange={(e) => handleChange('address.district', e.target.value)}
                  placeholder="Enter district"
                />

                <Input
                  label="State"
                  value={formData.address.state}
                  onChange={(e) => handleChange('address.state', e.target.value)}
                  placeholder="Enter state"
                />

                <Input
                  label="Pin Code"
                  value={formData.address.pinCode}
                  onChange={(e) => handleChange('address.pinCode', e.target.value)}
                  placeholder="Enter pin code"
                />

                <Input
                  label="Post Office"
                  value={formData.address.postOffice}
                  onChange={(e) => handleChange('address.postOffice', e.target.value)}
                  placeholder="Enter post office"
                />
              </div>
          </Card>

          {/* Form Actions */}
          <div className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none rounded-card border border-line bg-white/90 px-4 py-3 shadow-card backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate(`/admin/tenants/${id}`)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSaving}
              className="flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  Saving...
                </>
              ) : (
                <>
                  <FiSave className="h-3.5 w-3.5" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
