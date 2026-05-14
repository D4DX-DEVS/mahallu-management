import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import RadioCardGroup from '@/components/ui/RadioCardGroup';
import QuickAddFamily from '@/components/quick-add/QuickAddFamily';
import QuickAddTenantSetting from '@/components/quick-add/QuickAddTenantSetting';
import { ROUTES } from '@/constants/routes';
import { memberService } from '@/services/memberService';
import { familyService } from '@/services/familyService';
import { tenantService } from '@/services/tenantService';
import { Family } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { getTenantId as extractTenantId } from '@/utils/tenantHelper';

const memberSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  nameMl: z.string().optional(),
  familyId: z.string().min(1, 'Family is required'),
  familyName: z.string().min(1, 'Family Name is required'),
  age: z.preprocess((val) => (val === '' || Number.isNaN(val) ? undefined : val), z.number().min(0).max(150).optional()),
  gender: z.enum(['male', 'female']).optional().or(z.literal('')),
  bloodGroup: z
    .enum(['A +ve', 'A -ve', 'B +ve', 'B -ve', 'AB +ve', 'AB -ve', 'O +ve', 'O -ve'])
    .optional()
    .or(z.literal('')),
  healthStatus: z.string().optional(),
  phone: z.string().optional().refine(
    (val) => !val || /^\d{10}$/.test(val),
    { message: 'Phone number must be exactly 10 digits' }
  ),
  education: z.string().optional(),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional().or(z.literal('')),
  marriageCount: z.preprocess((val) => (val === '' || Number.isNaN(val) ? undefined : val), z.number().min(0).optional()),
  isOrphan: z.boolean().optional(),
  isDead: z.boolean().optional(),
});

type MemberFormData = z.infer<typeof memberSchema>;

export default function CreateMember() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loadingFamilies, setLoadingFamilies] = useState(true);
  const [educationOptions, setEducationOptions] = useState<string[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [addFamilyOpen, setAddFamilyOpen] = useState(false);
  const [addEducationOpen, setAddEducationOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
  });

  const selectedFamilyId = watch('familyId');

  useEffect(() => {
    fetchFamilies();
  }, []);

  useEffect(() => {
    if (selectedFamilyId) {
      const selectedFamily = families.find((f) => f.id === selectedFamilyId);
      if (selectedFamily) {
        setValue('familyName', selectedFamily.houseName);
      }
    }
  }, [selectedFamilyId, families, setValue]);

  const fetchFamilies = async () => {
    try {
      setLoadingFamilies(true);
      const result = await familyService.getAll();
      setFamilies(result.data || []);

      // Fetch education options from tenant settings
      const { currentTenantId, user } = useAuthStore.getState();
      const tid = extractTenantId(user, currentTenantId);
      setTenantId(tid);
      if (tid) {
        try {
          const tenantData = await tenantService.getById(tid);
          setEducationOptions(tenantData.settings?.educationOptions || [
            'Below SSLC',
            'SSLC',
            'Plus Two',
            'Degree',
            'Diploma',
            'Post Graduation',
            'Doctorate',
            'MBBS',
          ]);
        } catch (err) {
          console.error('Failed to fetch education options:', err);
        }
      }
    } catch (err) {
      console.error('Error fetching families:', err);
      setFamilies([]);
    } finally {
      setLoadingFamilies(false);
    }
  };

  const onSubmit = async (data: MemberFormData) => {
    try {
      setError(null);
      // Clean up empty strings and convert types
      const memberData = Object.fromEntries(
        Object.entries({
          ...data,
          age: data.age == null || Number.isNaN(data.age) ? undefined : Number(data.age),
          gender: data.gender === '' ? undefined : data.gender,
          bloodGroup: data.bloodGroup === '' ? undefined : data.bloodGroup,
          maritalStatus: data.maritalStatus === '' ? undefined : data.maritalStatus,
          marriageCount: data.marriageCount == null || Number.isNaN(data.marriageCount) ? undefined : Number(data.marriageCount),
        }).filter(([_, v]) => v !== '' && v !== undefined && !Number.isNaN(v))
      );
      await memberService.create(memberData);
      navigate(ROUTES.MEMBERS.LIST);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create member. Please try again.');
      console.error('Error creating member:', err);
    }
  };

  const genderOptions = [
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
  ];

  const bloodGroupOptions = [
    { value: 'A +ve', label: 'A +ve' },
    { value: 'A -ve', label: 'A -ve' },
    { value: 'B +ve', label: 'B +ve' },
    { value: 'B -ve', label: 'B -ve' },
    { value: 'AB +ve', label: 'AB +ve' },
    { value: 'AB -ve', label: 'AB -ve' },
    { value: 'O +ve', label: 'O +ve' },
    { value: 'O -ve', label: 'O -ve' },
  ];

  const maritalStatusOptions = [
    { value: '', label: 'Select Marital Status' },
    { value: 'single', label: 'Single' },
    { value: 'married', label: 'Married' },
    { value: 'divorced', label: 'Divorced' },
    { value: 'widowed', label: 'Widowed' },
  ];

  const healthStatusOptions = [
    { value: '', label: 'Select Health Status' },
    { value: 'healthy', label: 'Healthy' },
    { value: 'under_treatment', label: 'Under Treatment' },
    { value: 'chronic', label: 'Chronic Illness' },
    { value: 'disabled', label: 'Disabled' },
    { value: 'critical', label: 'Critical' },
    { value: 'recovering', label: 'Recovering' },
  ];

  const familyOptions = [
    { value: '', label: 'Select family...' },
    ...families.map((family) => ({
      value: family.id,
      label: `${family.houseName}${family.mahallId ? ` (${family.mahallId})` : ''}`,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Create Member
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Add a new family member with complete information
          </p>
        </div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Members', path: ROUTES.MEMBERS.LIST },
            { label: 'Create' },
          ]}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
              {error}
            </div>
          )}

          {/* Basic Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Basic Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Family"
                options={familyOptions}
                value={watch('familyId') || ''}
                onAddNew={() => setAddFamilyOpen(true)}
                addNewLabel="Add Family"
                {...register('familyId')}
                error={errors.familyId?.message}
                required
                disabled={loadingFamilies}
                className="md:col-span-2"
              />
              <Input
                label="Family Name"
                {...register('familyName')}
                error={errors.familyName?.message}
                required
                disabled
                className="md:col-span-2"
              />
              <Input
                label="Member Name"
                {...register('name')}
                error={errors.name?.message}
                required
                placeholder="Full Name"
              />
              <Input
                label="Member Name (Malayalam)"
                {...register('nameMl')}
                placeholder="പേര്"
                className="font-malayalam"
              />
              <Input
                label="Age"
                type="number"
                {...register('age', { valueAsNumber: true })}
                error={errors.age?.message}
                placeholder="Age"
                min={0}
                max={150}
              />
            </div>
            <div className="md:col-span-2">
              <RadioCardGroup
                label="Gender"
                options={genderOptions}
                value={watch('gender') || ''}
                onChange={(value) => setValue('gender', value as 'male' | 'female')}
                error={errors.gender?.message}
                columns={2}
              />
            </div>
            <div className="md:col-span-2">
              <RadioCardGroup
                label="Blood Group"
                options={bloodGroupOptions}
                value={watch('bloodGroup') || ''}
                onChange={(value) => setValue('bloodGroup', value as any)}
                error={errors.bloodGroup?.message}
                columns={4}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:col-span-2">
              <Input
                label="Phone"
                type="tel"
                {...register('phone')}
                error={errors.phone?.message}
                placeholder="Phone Number (10 digits)"
                maxLength={10}
              />
            </div>
          </div>

          {/* Additional Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Additional Information
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Health Status"
                {...register('healthStatus')}
                options={healthStatusOptions}
                className="md:col-span-2"
              />
              <Select
                label="Education"
                {...register('education')}
                value={watch('education') || ''}
                onAddNew={tenantId ? () => setAddEducationOpen(true) : undefined}
                addNewLabel="Add Education"
                options={[
                  { value: '', label: 'Select Education' },
                  ...educationOptions.map(opt => ({ value: opt, label: opt }))
                ]}
                className="md:col-span-2"
              />
              <Select
                label="Marital Status"
                {...register('maritalStatus')}
                options={maritalStatusOptions}
              />
              <Input
                label="Number of Marriages"
                type="number"
                min={0}
                {...register('marriageCount', { valueAsNumber: true })}
                placeholder="0"
              />
              <div className="flex items-center gap-4 md:col-span-2">
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" {...register('isOrphan')} className="rounded border-gray-300 text-primary-600" />
                  Is Orphan
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" {...register('isDead')} className="rounded border-gray-300 text-primary-600" />
                  Is Deceased
                </label>
              </div>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(ROUTES.MEMBERS.LIST)}
            >
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-4 w-4 mr-2" />
              Create Member
            </Button>
          </div>
        </Card>
      </form>

      <QuickAddFamily
        open={addFamilyOpen}
        onClose={() => setAddFamilyOpen(false)}
        onCreated={(newFamily) => {
          setFamilies((prev) => [...prev, { id: newFamily.id, houseName: newFamily.label } as Family]);
          setValue('familyId', newFamily.id, { shouldValidate: true });
          setValue('familyName', newFamily.label);
        }}
      />

      {tenantId && (
        <QuickAddTenantSetting
          open={addEducationOpen}
          onClose={() => setAddEducationOpen(false)}
          settingKey="educationOptions"
          label="Education"
          placeholder="e.g. B.Tech, M.A."
          tenantId={tenantId}
          onCreated={(edu) => {
            setEducationOptions((prev) => [...prev, edu]);
            setValue('education', edu);
          }}
        />
      )}
    </div>
  );
}

