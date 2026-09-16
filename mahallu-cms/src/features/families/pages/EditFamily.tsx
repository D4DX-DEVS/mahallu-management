import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/constants/routes';
import { familyService } from '@/services/familyService';
import WelfareSection from '../components/WelfareSection';
import { tenantService } from '@/services/tenantService';
import { useAuthStore } from '@/store/authStore';
import { Family } from '@/types';
import { getTenantId } from '@/utils/tenantHelper';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import { toast } from '@/store/toastStore';

const familySchema = z.object({
  mahallId: z.string().max(200, 'Please keep the mahall to 200 characters or less.').optional(),
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
  status: z.enum(['approved', 'unapproved', 'pending']).optional(),
  economicStatus: z.enum(['stable', 'struggling', 'needs_assistance']).optional().or(z.literal('')),
  welfareStatus: z.enum(['none', 'receiving', 'applied', 'needs_review']).optional().or(z.literal('')),
  housingType: z.enum(['own', 'rented', 'shared', 'none']).optional().or(z.literal('')),
  specialRequirements: z.string().max(200, 'Please keep the special requirements to 200 characters or less.').optional(),
});

type FamilyFormData = z.infer<typeof familySchema>;

export default function EditFamily() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { currentTenantId, user } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState<Array<{ name: string; amount: number }>>([]);
  const [areaOptions, setAreaOptions] = useState<string[]>([]);

  const tenantId = getTenantId(user, currentTenantId);

  useEffect(() => {
    const fetchSettings = async () => {
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
    fetchSettings();
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

  useEffect(() => {
    if (id) {
      fetchFamily();
    }
  }, [id]);

  const fetchFamily = async () => {
    try {
      setLoading(true);
      const family = await familyService.getById(id!);
      setValue('mahallId', family.mahallId || '');
      setValue('varisangyaGrade', family.varisangyaGrade || '');
      setValue('houseName', family.houseName);
      setValue('houseNameMl', family.houseNameMl || '');
      setValue('familyHead', family.familyHead || '');
      setValue('familyHeadMl', family.familyHeadMl || '');
      setValue('contactNo', family.contactNo || '');
      setValue('wardNumber', family.wardNumber || '');
      setValue('houseNo', family.houseNo || '');
      setValue('area', family.area || '');
      setValue('areaMl', family.areaMl || '');
      setValue('place', family.place || '');
      setValue('placeMl', family.placeMl || '');
      setValue('status', family.status || 'pending');
      setValue('economicStatus', ((family as any).economicStatus || '') as any);
      setValue('welfareStatus', ((family as any).welfareStatus || '') as any);
      setValue('housingType', ((family as any).housingType || '') as any);
      setValue('specialRequirements', (family as any).specialRequirements || '');
    } catch (err: any) {
      setError(loadErrorMessage(err, 'family'));
    } finally {
      setLoading(false);
    }
  };

  /* Only these fields are zod enums, where an empty string fails validation
   * and must be dropped rather than sent. Stripping *every* empty string used
   * to also drop free-text fields the user deliberately cleared — e.g. Family
   * Head — so the old value silently survived on the server. */
  const ENUM_FIELDS = new Set(['economicStatus', 'welfareStatus', 'housingType']);

  const onSubmit = async (data: FamilyFormData) => {
    if (!id) return;
    try {
      setError(null);
      const cleanedData = Object.fromEntries(
        Object.entries(data).filter(([key, v]) => !(ENUM_FIELDS.has(key) && v === ''))
      );
      await familyService.update(id, cleanedData);
      toast.success('Family updated');
      navigate(ROUTES.FAMILIES.LIST);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'update family. please try again' }));
      console.error('Error updating family:', err);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  const gradeOptions = [
    { value: '', label: 'Select grade...' },
    ...grades.map((grade) => ({
      value: grade.name,
      label: `${toTitleCase(grade.name)} - ₹${grade.amount}`,
    })),
  ];

  const areaSelectOptions = [
    { value: '', label: 'Select area...' },
    ...areaOptions.map((area) => ({ value: area, label: toTitleCase(area) })),
  ];

  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'approved', label: 'Approved' },
    { value: 'unapproved', label: 'Unapproved' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="Edit Family" description="Update household information" breadcrumbs={[{ label: 'Families', path: ROUTES.FAMILIES.LIST }]} />

      <Card padding="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          <section className="space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Household</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Family ID"
                {...register('mahallId')}
                placeholder="Auto-generated"
                disabled
                className="bg-muted"
              />
              <Select label="Status" options={statusOptions} {...register('status')} />
              <Input
                label="House Name"
                {...register('houseName')}
                error={errors.houseName?.message}
                required
                placeholder="e.g. Al-Hamd House"
              />
              <Input label="House No." {...register('houseNo')} placeholder="e.g. 12/345" />
              <Select label="Varisangya Grade" options={gradeOptions} {...register('varisangyaGrade')} />
              <Input label="Family Head" {...register('familyHead')} placeholder="Head name" />
              <div className="hidden">
                <Input label="House Name (Malayalam)" {...register('houseNameMl')} placeholder="വീട് പേര്" className="font-malayalam" />
              </div>
              <div className="hidden">
                <Input label="Family Head (Malayalam)" {...register('familyHeadMl')} placeholder="കുടുംബ നാഥൻ" className="font-malayalam" />
              </div>
            </div>
          </section>

          <section className="space-y-4 border-t border-border pt-6">
            <h2 className="text-sm font-semibold text-foreground">Contact</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label="Contact No." type="tel" {...register('contactNo')} error={errors.contactNo?.message} placeholder="10-digit mobile" maxLength={10} />
              <Input label="Ward Number" {...register('wardNumber')} error={errors.wardNumber?.message} placeholder="e.g. 12" type="number" min={1} />
            </div>
          </section>

          <section className="space-y-4 border-t border-border pt-6">
            <h2 className="text-sm font-semibold text-foreground">Location</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select label="Area" options={areaSelectOptions} {...register('area')} />
              <Input label="Place" {...register('place')} placeholder="e.g. Calicut" />
              <div className="hidden">
                <Input label="Area (Malayalam)" {...register('areaMl')} placeholder="പ്രദേശം" className="font-malayalam" />
              </div>
              <div className="hidden">
                <Input label="Place (Malayalam)" {...register('placeMl')} placeholder="സ്ഥലം" className="font-malayalam" />
              </div>
            </div>
          </section>

          <div className="border-t border-border pt-6">
            <WelfareSection register={register} defaultOpen />
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-6 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.FAMILIES.LIST)} className="w-full sm:w-auto">
              <FiX className="h-4 w-4" aria-hidden="true" /> Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} className="w-full sm:w-auto">
              <FiSave className="h-4 w-4" aria-hidden="true" /> Update Family
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
