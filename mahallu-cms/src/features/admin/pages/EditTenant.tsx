import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiSave, FiArrowLeft } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { Tenant } from '@/types/tenant';
import { tenantService } from '@/services/tenantService';

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
      const tenant = await tenantService.getById(id!);
      setFormData({
        name: tenant.name || '',
        nameMl: tenant.nameMl || '',
        code: tenant.code || '',
        location: tenant.location || '',
        locationMl: tenant.locationMl || '',
        type: tenant.type || 'standard',
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
      setError(error.response?.data?.message || 'Failed to load tenant');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      setIsSaving(true);
      setError(null);
      await tenantService.update(id!, formData);
      navigate(`/admin/tenants/${id}`);
    } catch (error: any) {
      console.error('Error updating tenant:', error);
      setError(error.response?.data?.message || 'Failed to update tenant');
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

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Admin', path: '/admin/tenants' },
    { label: 'Tenants', path: '/admin/tenants' },
    { label: formData.name || 'Edit' },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={breadcrumbItems} />
        <Card>
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Breadcrumb items={breadcrumbItems} />
        <Card>
          <div className="text-center py-12">
            <p className="text-red-500 dark:text-red-400 mb-4">{error}</p>
            <Button
              variant="outline"
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
      <Breadcrumb items={breadcrumbItems} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/admin/tenants/${id}`)}
            className="flex items-center gap-2"
          >
            <FiArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Edit Tenant
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Update tenant information
            </p>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card title="Tenant Information">
          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
          <div className="space-y-4">
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

            {/* Address Section */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Address Details</h3>
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
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
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
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <FiSave className="h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
