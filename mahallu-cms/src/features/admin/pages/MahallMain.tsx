import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiSave, FiSettings, FiMapPin, FiInfo, FiDollarSign } from 'react-icons/fi';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import StatusBadge from '@/components/ui/StatusBadge';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input, { labelClasses } from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { tenantService } from '@/services/tenantService';
import { CLASSIFICATION_LABELS, TenantClassification } from '@/constants/modules';
import StringListEditor from '../components/StringListEditor';
import { useAuthStore } from '@/store/authStore';
import { Tenant } from '@/types/tenant';
import { formatDate } from '@/utils/format';
import { getTenantId } from '@/utils/tenantHelper';
import PageHeader from '@/components/ui/PageHeader';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

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
      const data = await tenantService.getById(tenantId, { force: true });
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
      setError(getFriendlyError(err, "Couldn't load tenant information. Refresh the page or try again."));
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

      await tenantService.update(tenantId, {
        settings: {
          ...tenant.settings,
          varisangyaAmount: data.varisangyaAmount,
          varisangyaGrades: grades,
          educationOptions: educationOptions,
          areaOptions: areaOptions,
        },
      });

      toast.success('Settings saved');
      await fetchTenant();
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't update settings. Try again in a moment."));
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
      <div className="space-y-4">
        <PageHeader
        title="Mahall Main"
        description="Manage mahall settings and configuration"
      />
        <Card>
          <div className="text-center py-12">
            {isSuperAdmin ? (
              <>
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-mint dark:bg-brand-lime/10">
                  <FiInfo className="h-6 w-6 text-primary-600 dark:text-brand-lime" />
                </div>
                <h3 className="mb-2 text-sm font-bold text-[#18231E] dark:text-surface-text">Select a Mahall to Manage</h3>
                <p className="text-xs text-[#7B8983] dark:text-surface-muted max-w-md mx-auto">
                  As a Super Admin, please select a mahall from the <strong>"Select Tenant"</strong> dropdown in the header to view and manage its settings.
                </p>
              </>
            ) : (
              <>
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF6CC] dark:bg-secondary-500/15">
                  <FiInfo className="h-6 w-6 text-[#7A5B00] dark:text-secondary-300" />
                </div>
                <h3 className="mb-2 text-sm font-bold text-[#18231E] dark:text-surface-text">No Mahall Assigned</h3>
                <p className="text-xs text-[#7B8983] dark:text-surface-muted max-w-md mx-auto">
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
      <div className="space-y-4">
        <PageHeader
        title="Mahall Main"
        description="Manage mahall settings and configuration"
      />
        <Card>
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchTenant} className="mt-4" variant="secondary">
              Retry
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mahall Main"
        description="Manage mahall settings and configuration"
        actions={
          (tenant as any)?.classification ? (
            <Badge variant="primary">
              {CLASSIFICATION_LABELS[(tenant as any).classification as TenantClassification] ||
                (tenant as any).classification}
            </Badge>
          ) : undefined
        }
      />

      {error && <Alert tone="danger">{error}</Alert>}


      {/* Tenant Information */}
      {tenant && (
        <Card>
          <div className="p-4">
            <div className="mb-4 flex items-center space-x-3">
              <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[11px] bg-mint dark:bg-brand-lime/15">
                <FiInfo className="h-[17px] w-[17px] text-primary-700 dark:text-brand-lime" />
              </div>
              <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">Tenant Information</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClasses}>Name</label>
                <p className="text-[13px] text-[#18231E] dark:text-surface-text">{tenant.name}</p>
              </div>
              <div>
                <label className={labelClasses}>Code</label>
                <p className="text-[13px] text-[#18231E] dark:text-surface-text">{tenant.code}</p>
              </div>
              <div>
                <label className={labelClasses}>Type</label>
                <p className="text-[13px] text-[#18231E] dark:text-surface-text capitalize">{tenant.type}</p>
              </div>
              <div>
                <label className={labelClasses}>Status</label>
                <StatusBadge status={tenant.status} tone={tenant.status === 'suspended' ? 'warning' : undefined} />
              </div>
              <div>
                <label className={labelClasses}>Location</label>
                <p className="text-[13px] text-[#18231E] dark:text-surface-text">{tenant.location || 'N/A'}</p>
              </div>
              <div>
                <label className={labelClasses}>Since</label>
                <p className="text-[13px] text-[#18231E] dark:text-surface-text">{formatDate(tenant.since)}</p>
              </div>
            </div>

            {tenant.address && (
              <div className="mt-6 pt-6 border-t border-line dark:border-surface-border">
                <div className="flex items-center space-x-3 mb-4">
                  <FiMapPin className="h-4 w-4 text-[#7B8983] dark:text-surface-muted" />
                  <h3 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">Address</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className={labelClasses}>State</label>
                    <p className="text-[13px] text-[#18231E] dark:text-surface-text">{tenant.address.state}</p>
                  </div>
                  <div>
                    <label className={labelClasses}>District</label>
                    <p className="text-[13px] text-[#18231E] dark:text-surface-text">{tenant.address.district}</p>
                  </div>
                  <div>
                    <label className={labelClasses}>LSG Name</label>
                    <p className="text-[13px] text-[#18231E] dark:text-surface-text">{tenant.address.lsgName}</p>
                  </div>
                  <div>
                    <label className={labelClasses}>Village</label>
                    <p className="text-[13px] text-[#18231E] dark:text-surface-text">{tenant.address.village}</p>
                  </div>
                  {tenant.address.pinCode && (
                    <div>
                      <label className={labelClasses}>
                        PIN Code
                      </label>
                      <p className="text-[13px] text-[#18231E] dark:text-surface-text">{tenant.address.pinCode}</p>
                    </div>
                  )}
                  {tenant.address.postOffice && (
                    <div>
                      <label className={labelClasses}>
                        Post Office
                      </label>
                      <p className="text-[13px] text-[#18231E] dark:text-surface-text">{tenant.address.postOffice}</p>
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
          <div className="p-4">
            <div className="mb-4 flex items-center space-x-3">
              <div className="flex h-[34px] w-[34px] items-center justify-center rounded-[11px] bg-mint dark:bg-brand-lime/15">
                <FiSettings className="h-[17px] w-[17px] text-primary-700 dark:text-brand-lime" />
              </div>
              <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">Settings</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label
                  htmlFor="varisangyaAmount"
                  className={labelClasses}
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
                <p className="mt-1 text-xs text-[#7B8983] dark:text-surface-muted">
                  Default amount for varisangya payments
                </p>
              </div>

              {/* Varisangya Grades */}
              <div className="mt-6 border-t border-line pt-5 dark:border-surface-border">
                <h3 className="mb-0.5 text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">
                  Varisangya Grades
                </h3>
                <p className="mb-3 text-xs text-[#7B8983] dark:text-surface-muted">
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
                        variant="secondary"
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
                    variant="secondary"
                    onClick={() => {
                      setGrades([...grades, { name: `Grade ${String.fromCharCode(65 + grades.length)}`, amount: 0 }]);
                    }}
                    className="w-full mt-2"
                  >
                    + Add Grade
                  </Button>
                </div>
              </div>

              <StringListEditor
                title="Education Options"
                description="Configure education qualification options for member profiles"
                values={educationOptions}
                onChange={setEducationOptions}
                placeholder="Education option (e.g., SSLC)"
                addLabel="+ Add Education Option"
              />

              <StringListEditor
                title="Area Options"
                description="Configure area/locality options for family addresses"
                values={areaOptions}
                onChange={setAreaOptions}
                placeholder="Area option (e.g., Area A)"
                addLabel="+ Add Area Option"
              />
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
                    <FiSave className="h-3.5 w-3.5" />
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

