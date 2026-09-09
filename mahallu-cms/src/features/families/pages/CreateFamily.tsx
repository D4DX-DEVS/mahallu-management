import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import QuickAddTenantSetting from '@/components/quick-add/QuickAddTenantSetting';
import QuickAddVarisangyaGrade from '@/components/quick-add/QuickAddVarisangyaGrade';
import { ROUTES } from '@/constants/routes';
import { familyService } from '@/services/familyService';
import WelfareSection from '../components/WelfareSection';
import { tenantService } from '@/services/tenantService';
import { useAuthStore } from '@/store/authStore';
import { getTenantId } from '@/utils/tenantHelper';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const familySchema = z.object({
  varisangyaGrade: z.string().max(200, 'Please keep the varisangya grade to 200 characters or less.').optional(),
  houseName: z.string().max(200, 'Please keep the house name to 200 characters or less.').min(1, 'House Name is required'),
  houseNameMl: z.string().max(200, 'Please keep the house name to 200 characters or less.').optional(),
  familyHead: z.string().max(200, 'Please keep the family head to 200 characters or less.').optional(),
  familyHeadMl: z.string().max(200, 'Please keep the family head to 200 characters or less.').optional(),
  contactNo: z
    .string()
    .optional()
    .refine((val) => !val || /^\d{10}$/.test(val), { message: 'Contact number must be exactly 10 digits' }),
  wardNumber: z
    .string()
    .optional()
    .refine((val) => !val || /^\d+$/.test(val), { message: 'Ward number must contain only digits' }),
  houseNo: z.string().max(200, 'Please keep the house no to 200 characters or less.').optional(),
  area: z.string().max(200, 'Please keep the area to 200 characters or less.').optional(),
  areaMl: z.string().max(200, 'Please keep the area to 200 characters or less.').optional(),
  place: z.string().max(300, 'Please keep the place to 300 characters or less.').optional(),
  placeMl: z.string().max(300, 'Please keep the place to 300 characters or less.').optional(),
  economicStatus: z.enum(['stable', 'struggling', 'needs_assistance']).optional().or(z.literal('')),
  welfareStatus: z.enum(['none', 'receiving', 'applied', 'needs_review']).optional().or(z.literal('')),
  housingType: z.enum(['own', 'rented', 'shared', 'none']).optional().or(z.literal('')),
  specialRequirements: z.string().max(200, 'Please keep the special requirements to 200 characters or less.').optional(),
});

type FamilyFormData = z.infer<typeof familySchema>;

export default function CreateFamily() {
  const navigate = useNavigate();
  const { currentTenantId, user } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [grades, setGrades] = useState<Array<{ name: string; amount: number }>>([]);
  const [areaOptions, setAreaOptions] = useState<string[]>([]);
  const [addGradeOpen, setAddGradeOpen] = useState(false);
  const [addAreaOpen, setAddAreaOpen] = useState(false);

  const tenantId = getTenantId(user, currentTenantId);

  useEffect(() => {
    const fetchTenantSettings = async () => {
      if (tenantId) {
        try {
          const tenant = await tenantService.getById(tenantId);
          setGrades(tenant.settings?.varisangyaGrades || []);
          setAreaOptions(tenant.settings?.areaOptions || ['Area A', 'Area B', 'Area C', 'Area D']);
        } catch (err) {
          console.error('Error fetching tenant settings:', err);
        }
      }
    };
    fetchTenantSettings();
  }, [tenantId]);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FamilyFormData>({
    resolver: zodResolver(familySchema),
  });

  const onSubmit = async (data: FamilyFormData) => {
    try {
      setError(null);
      // Strip empty strings from optional select fields to avoid enum validation errors
      const cleanedData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== '' && v !== undefined)
      );
      await familyService.create(cleanedData);
      navigate(ROUTES.FAMILIES.LIST);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'create family. please try again' }));
      console.error('Error creating family:', err);
    }
  };

  const gradeOptions = [
    { value: '', label: 'Select grade...' },
    ...grades.map((grade) => ({
      value: grade.name,
      label: `${grade.name} - ₹${grade.amount}`,
    })),
  ];

  const areaSelectOptions = [
    { value: '', label: 'Select an area...' },
    ...areaOptions.map((area) => ({ value: area, label: area })),
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Create Family"
        description="Add a new family with complete information"
        breadcrumbs={[{ label: 'Families', path: ROUTES.FAMILIES.LIST }]}
      />

      <Card padding="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Varisangya Grade"
              options={gradeOptions}
              value={watch('varisangyaGrade') || ''}
              onAddNew={tenantId ? () => setAddGradeOpen(true) : undefined}
              addNewLabel="Add Grade"
              {...register('varisangyaGrade')}
            />
            <Input
              label="House Name"
              {...register('houseName')}
              error={errors.houseName?.message}
              required
              placeholder="House Name"
            />
            <div className="hidden">
              <Input
                label="House Name (Malayalam)"
                {...register('houseNameMl')}
                placeholder="വീട് പേര്"
                className="font-malayalam"
              />
            </div>
            <div className="hidden">
              <Input label="Family Head" {...register('familyHead')} placeholder="Family Head Name" />
            </div>
            <div className="hidden">
              <Input
                label="Family Head (Malayalam)"
                {...register('familyHeadMl')}
                placeholder="കുടുംബ നാഥൻ"
                className="font-malayalam"
              />
            </div>
            <Input
              label="Contact No."
              type="tel"
              {...register('contactNo')}
              error={errors.contactNo?.message}
              placeholder="Contact No. (10 digits)"
              maxLength={10}
            />
            <Input
              label="Ward Number"
              {...register('wardNumber')}
              error={errors.wardNumber?.message}
              placeholder="Ward Number"
              type="number"
              min={1}
            />
            <Input label="House No." {...register('houseNo')} placeholder="House No." />
            <Select
              label="Area"
              options={areaSelectOptions}
              value={watch('area') || ''}
              onAddNew={tenantId ? () => setAddAreaOpen(true) : undefined}
              addNewLabel="Add Area"
              {...register('area')}
            />
            <div className="hidden">
              <Input
                label="Area (Malayalam)"
                {...register('areaMl')}
                placeholder="പ്രദേശം"
                className="font-malayalam"
              />
            </div>
            <Input label="Place" {...register('place')} placeholder="Place" />
            <div className="hidden">
              <Input
                label="Place (Malayalam)"
                {...register('placeMl')}
                placeholder="സ്ഥലം"
                className="font-malayalam"
              />
            </div>
          </div>

          <div className="pt-4">
            <WelfareSection register={register} />
          </div>

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.FAMILIES.LIST)}>
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
              <FiSave className="h-4 w-4 mr-2" />
              Create Family
            </Button>
          </div>
        </form>
      </Card>

      {tenantId && (
        <>
          <QuickAddVarisangyaGrade
            open={addGradeOpen}
            onClose={() => setAddGradeOpen(false)}
            tenantId={tenantId}
            onCreated={(grade) => {
              setGrades((prev) => [...prev, grade]);
              setValue('varisangyaGrade', grade.name);
            }}
          />
          <QuickAddTenantSetting
            open={addAreaOpen}
            onClose={() => setAddAreaOpen(false)}
            settingKey="areaOptions"
            label="Area"
            placeholder="e.g. North Area, South Area"
            tenantId={tenantId}
            onCreated={(area) => {
              setAreaOptions((prev) => [...prev, area]);
              setValue('area', area);
            }}
          />
        </>
      )}
    </div>
  );
}
