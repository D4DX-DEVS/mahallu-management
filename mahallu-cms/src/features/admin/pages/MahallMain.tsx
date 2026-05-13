import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiSave, FiSettings, FiMapPin, FiInfo, FiDollarSign } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { tenantService } from '@/services/tenantService';
import { useAuthStore } from '@/store/authStore';
import { Tenant } from '@/types/tenant';
import { formatDate } from '@/utils/format';
import { getTenantId } from '@/utils/tenantHelper';

const settingsSchema = z.object({
  varisangyaAmount: z.number().min(0, 'Varisangya amount must be positive'),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function MahallMain() {
  const { currentTenantId, user, isSuperAdmin } = useAuthStore();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [grades, setGrades] = useState<Array<{ name: string; amount: number }>>([]);
  const [educationOptions, setEducationOptions] = useState<string[]>([]);
  const [areaOptions, setAreaOptions] = useState<string[]>([]);

  const tenantId = getTenantId(user, currentTenantId);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
  });

  useEffect(() => {
    if (tenantId) {
      fetchTenant();
    } else {
      setLoading(false);
    }
  }, [tenantId]);

  const fetchTenant = async () => {
    if (!tenantId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await tenantService.getById(tenantId);
      setTenant(data);
      setGrades(data.settings?.varisangyaGrades || [
        { name: 'Grade A', amount: 100 },
        { name: 'Grade B', amount: 75 },
        { name: 'Grade C', amount: 50 },
        { name: 'Grade D', amount: 25 },
      ]);
      setEducationOptions(data.settings?.educationOptions || [
        'Below SSLC',
        'SSLC',
        'Plus Two',
        'Degree',
        'Diploma',
        'Post Graduation',
        'Doctorate',
        'MBBS',
      ]);
      setAreaOptions(data.settings?.areaOptions || [
        'Area A',
        'Area B',
        'Area C',
        'Area D',
      ]);
      reset({
        varisangyaAmount: data.settings?.varisangyaAmount || 0,
      });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load tenant information');
      console.error('Error fetching tenant:', err);
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: SettingsFormData) => {
    if (!tenantId || !tenant) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await tenantService.update(tenantId, {
        settings: {
          ...tenant.settings,
          varisangyaAmount: data.varisangyaAmount,
          varisangyaGrades: grades,
          educationOptions: educationOptions,
          areaOptions: areaOptions,
        },
      });

      setSuccess('Settings updated successfully');
      await fetchTenant();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update settings');
      console.error('Error updating settings:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!tenantId && !tenant) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mahall Main</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage mahall settings and configuration</p>
          </div>
          <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Mahall Main' }]} />
        </div>
        <Card>
          <div className="text-center py-12">
            {isSuperAdmin ? (
              <>
                <div className="mx-auto w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                  <FiInfo className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">Select a Mahall to Manage</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  As a Super Admin, please select a mahall from the <strong>"Select Tenant"</strong> dropdown in the header to view and manage its settings.
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mb-4">
                  <FiInfo className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Mahall Assigned</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                  Your account is not linked to any mahall yet. Please contact your administrator to get assigned to a mahall.
                </p>
              </>
            )}
          </div>
        </Card>
      </div>
    );
  }

  if (error && !tenant) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mahall Main</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage mahall settings and configuration</p>
          </div>
          <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Mahall Main' }]} />
        </div>
        <Card>
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchTenant} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mahall Main</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage mahall settings and configuration</p>
        </div>
        <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Mahall Main' }]} />
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
        </div>
      )}

      {/* Tenant Information */}
      {tenant && (
        <Card>
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <FiInfo className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tenant Information</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <p className="text-gray-900 dark:text-gray-100">{tenant.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Code</label>
                <p className="text-gray-900 dark:text-gray-100">{tenant.code}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
                <p className="text-gray-900 dark:text-gray-100 capitalize">{tenant.type}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
                <span
                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    tenant.status === 'active'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : tenant.status === 'suspended'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                      : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                  }`}
                >
                  {tenant.status}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                <p className="text-gray-900 dark:text-gray-100">{tenant.location || 'N/A'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Since</label>
                <p className="text-gray-900 dark:text-gray-100">{formatDate(tenant.since)}</p>
              </div>
            </div>

            {tenant.address && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-3 mb-4">
                  <FiMapPin className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                  <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100">Address</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">State</label>
                    <p className="text-gray-900 dark:text-gray-100">{tenant.address.state}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">District</label>
                    <p className="text-gray-900 dark:text-gray-100">{tenant.address.district}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">LSG Name</label>
                    <p className="text-gray-900 dark:text-gray-100">{tenant.address.lsgName}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Village</label>
                    <p className="text-gray-900 dark:text-gray-100">{tenant.address.village}</p>
                  </div>
                  {tenant.address.pinCode && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        PIN Code
                      </label>
                      <p className="text-gray-900 dark:text-gray-100">{tenant.address.pinCode}</p>
                    </div>
                  )}
                  {tenant.address.postOffice && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Post Office
                      </label>
                      <p className="text-gray-900 dark:text-gray-100">{tenant.address.postOffice}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Settings */}
      <Card>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-6">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <FiSettings className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="varisangyaAmount"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
                >
                  <div className="flex items-center space-x-2">
                    <FiDollarSign className="h-4 w-4" />
                    <span>Varisangya Amount</span>
                  </div>
                </label>
                <Input
                  id="varisangyaAmount"
                  type="number"
                  step="0.01"
                  {...register('varisangyaAmount', { valueAsNumber: true })}
                  error={errors.varisangyaAmount?.message}
                  placeholder="Enter varisangya amount"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Default amount for varisangya payments
                </p>
              </div>

              {/* Varisangya Grades */}
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Varisangya Grades
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Configure different grade levels with their corresponding amounts
                </p>
                
                <div className="space-y-3">
                  {grades.map((grade, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="flex-1">
                        <Input
                          value={grade.name}
                          onChange={(e) => {
                            const newGrades = [...grades];
                            newGrades[index].name = e.target.value;
                            setGrades(newGrades);
                          }}
                          placeholder="Grade name (e.g., Grade A)"
                        />
                      </div>
                      <div className="flex-1">
                        <Input
                          type="number"
                          step="0.01"
                          value={grade.amount}
                          onChange={(e) => {
                            const newGrades = [...grades];
                            newGrades[index].amount = parseFloat(e.target.value) || 0;
                            setGrades(newGrades);
                          }}
                          placeholder="Amount"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const newGrades = grades.filter((_, i) => i !== index);
                          setGrades(newGrades);
                        }}
                        className="whitespace-nowrap"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setGrades([...grades, { name: `Grade ${String.fromCharCode(65 + grades.length)}`, amount: 0 }]);
                    }}
                    className="w-full mt-2"
                  >
                    + Add Grade
                  </Button>
                </div>
              </div>

              {/* Education Options */}
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Education Options
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Configure education qualification options for member profiles
                </p>
                
                <div className="space-y-3">
                  {educationOptions.map((option, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="flex-1">
                        <Input
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...educationOptions];
                            newOptions[index] = e.target.value;
                            setEducationOptions(newOptions);
                          }}
                          placeholder="Education option (e.g., SSLC)"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const newOptions = educationOptions.filter((_, i) => i !== index);
                          setEducationOptions(newOptions);
                        }}
                        className="whitespace-nowrap"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEducationOptions([...educationOptions, '']);
                    }}
                    className="w-full mt-2"
                  >
                    + Add Education Option
                  </Button>
                </div>
              </div>

              {/* Area Options */}
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-md font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Area Options
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  Configure area/locality options for family addresses
                </p>
                
                <div className="space-y-3">
                  {areaOptions.map((option, index) => (
                    <div key={index} className="flex items-center gap-4">
                      <div className="flex-1">
                        <Input
                          value={option}
                          onChange={(e) => {
                            const newOptions = [...areaOptions];
                            newOptions[index] = e.target.value;
                            setAreaOptions(newOptions);
                          }}
                          placeholder="Area option (e.g., Area A)"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          const newOptions = areaOptions.filter((_, i) => i !== index);
                          setAreaOptions(newOptions);
                        }}
                        className="whitespace-nowrap"
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                  
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setAreaOptions([...areaOptions, '']);
                    }}
                    className="w-full mt-2"
                  >
                    + Add Area Option
                  </Button>
                </div>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <div className="mr-2">
                      <LoadingSpinner size="sm" />
                    </div>
                    Saving...
                  </>
                ) : (
                  <>
                    <FiSave className="h-4 w-4 mr-2" />
                    Save Settings
                  </>
                )}
              </Button>
            </div>
          </div>
        </form>
      </Card>
    </div>
  );
}

