import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import RadioCardGroup from '@/components/ui/RadioCardGroup';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { ROUTES } from '@/constants/routes';
import SocioEconomicSection from '../components/SocioEconomicSection';
import {
  socioEconomicSchemaFields,
  normalizeSocioEconomic,
  socioEconomicDefaults,
} from '../socioEconomicFields';
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
  mahallId: z.string().optional(),
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
  ...socioEconomicSchemaFields,
});

type MemberFormData = z.infer<typeof memberSchema>;

export default function EditMember() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [educationOptions, setEducationOptions] = useState<string[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);

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
    if (id) {
      fetchMember();
    }
  }, [id]);

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
      const result = await familyService.getAll();
      setFamilies(result.data || []);
    } catch (err) {
      console.error('Error fetching families:', err);
      setFamilies([]);
    }
  };

  const fetchMember = async () => {
    try {
      setLoading(true);
      const member = await memberService.getById(id!);
      setValue('name', member.name);
      setValue('nameMl', member.nameMl || '');
      setValue('familyId', member.familyId);
      setValue('familyName', member.familyName);
      setValue('mahallId', member.mahallId || '');
      setValue('age', (member.age || '') as any);
      setValue('gender', (member.gender || '') as any);
      setValue('bloodGroup', (member.bloodGroup || '') as any);
      setValue('healthStatus', member.healthStatus || '');
      setValue('phone', member.phone || '');
      setValue('education', member.education || '');
      setValue('maritalStatus', (member.maritalStatus || '') as any);
      setValue('marriageCount', (member.marriageCount ?? '') as any);
      setValue('isOrphan', Boolean(member.isOrphan));
      setValue('isDead', Boolean(member.isDead));
      Object.entries(socioEconomicDefaults(member as any)).forEach(([field, value]) => {
        setValue(field as any, value as any);
      });

      // Fetch education options from tenant settings
      const { currentTenantId, user } = useAuthStore.getState();
      const tenantId = extractTenantId(user, currentTenantId);
      if (tenantId) {
        try {
          const tenantData = await tenantService.getById(tenantId);
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
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load member');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: MemberFormData) => {
    if (!id) return;
    try {
      setError(null);
      const memberData = Object.fromEntries(
        Object.entries({
          ...data,
          age: data.age == null || Number.isNaN(data.age) ? undefined : Number(data.age),
          gender: data.gender === '' ? undefined : data.gender,
          bloodGroup: data.bloodGroup === '' ? undefined : data.bloodGroup,
          maritalStatus: data.maritalStatus === '' ? undefined : data.maritalStatus,
          marriageCount: data.marriageCount == null || Number.isNaN(data.marriageCount) ? undefined : Number(data.marriageCount),
          ...normalizeSocioEconomic(data),
        }).filter(([_, v]) => v !== '' && v !== undefined && !(typeof v === 'number' && Number.isNaN(v)))
      );
      await memberService.update(id, memberData);
      navigate(ROUTES.MEMBERS.LIST);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update member. Please try again.');
      console.error('Error updating member:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

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
            Edit Member
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Update member information
          </p>
        </div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Members', path: ROUTES.MEMBERS.LIST },
            { label: 'Edit' },
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Family"
              options={familyOptions}
              {...register('familyId')}
              error={errors.familyId?.message}
              required
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
            <div className="hidden">
            <Input
              label="Member Name (Malayalam)"
              {...register('nameMl')}
              placeholder="പേര്"
              className="font-malayalam"
            />
            </div>
            <Input
              label="Member ID (Auto-generated)"
              {...register('mahallId')}
              placeholder="Member ID"
              disabled
              className="bg-gray-50 dark:bg-gray-800"
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
            <Select
              label="Health Status"
              {...register('healthStatus')}
              options={healthStatusOptions}
              className="md:col-span-2"
            />
            <Select
              label="Education"
              {...register('education')}
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

          <div className="pt-4">
            <SocioEconomicSection register={register} />
          </div>

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
              Update Member
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}

