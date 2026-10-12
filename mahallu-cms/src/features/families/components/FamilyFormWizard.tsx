import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import Alert from '@/components/ui/Alert';
import DraftAlert from '@/components/ui/DraftAlert';
import FormSection, { ReviewList } from '@/components/ui/FormSection';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import PhoneInput from '@/components/ui/PhoneInput';
import Select from '@/components/ui/Select';
import Stepper from '@/components/ui/Stepper';
import StickyActionBar from '@/components/ui/StickyActionBar';
import UnsavedChangesDialog from '@/components/ui/UnsavedChangesDialog';
import QuickAddTenantSetting from '@/components/quick-add/QuickAddTenantSetting';
import QuickAddVarisangyaGrade from '@/components/quick-add/QuickAddVarisangyaGrade';
import { ROUTES } from '@/constants/routes';
import { familyService, parseDuplicateError, DuplicateMatchItem } from '@/services/familyService';
import DuplicateWarning from './DuplicateWarning';
import { tenantService } from '@/services/tenantService';
import { useAuthStore } from '@/store/authStore';
import { getTenantId } from '@/utils/tenantHelper';
import { INDIAN_MOBILE_RE, PHONE_ERROR } from '@/utils/formFields';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useFormDraft } from '@/hooks/useFormDraft';
import { useFormWizard, WizardStep } from '@/hooks/useFormWizard';
import { ECONOMIC_STATUS_OPTIONS, WELFARE_STATUS_OPTIONS, HOUSING_TYPE_OPTIONS } from './WelfareSection';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const familySchema = z.object({
  mahallId: z.string().optional(),
  varisangyaGrade: z.string().optional(),
  houseName: z.string().trim().min(1, 'Enter the house name'),
  houseNameMl: z.string().optional(),
  familyHead: z.string().optional(),
  familyHeadMl: z.string().optional(),
  contactNo: z
    .string()
    .optional()
    .refine((val) => !val || INDIAN_MOBILE_RE.test(val), { message: PHONE_ERROR }),
  wardNumber: z
    .string()
    .optional()
    .refine((val) => !val || /^\d+$/.test(val), { message: 'Ward number must contain only digits' }),
  houseNo: z.string().optional(),
  area: z.string().optional(),
  areaMl: z.string().optional(),
  place: z.string().optional(),
  placeMl: z.string().optional(),
  status: z.enum(['approved', 'unapproved', 'pending']).optional(),
  economicStatus: z.enum(['stable', 'struggling', 'needs_assistance']).optional().or(z.literal('')),
  welfareStatus: z.enum(['none', 'receiving', 'applied', 'needs_review']).optional().or(z.literal('')),
  housingType: z.enum(['own', 'rented', 'shared', 'none']).optional().or(z.literal('')),
  specialRequirements: z.string().optional(),
});

type FamilyFormData = z.infer<typeof familySchema>;

const STEPS: WizardStep<FamilyFormData>[] = [
  { id: 'basics', label: 'Basics', fields: ['houseName', 'contactNo', 'familyHead'] },
  { id: 'address', label: 'Address', fields: ['wardNumber'] },
  { id: 'household', label: 'Household', fields: [] },
  { id: 'review', label: 'Review', fields: [] },
];

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'unapproved', label: 'Unapproved' },
];

const labelOf = (opts: { value: string; label: string }[], v?: string) => opts.find((o) => o.value === (v || ''))?.label;

/** Shared 4-step wizard for creating and editing a family (Basics > Address > Household > Review). */
export default function FamilyFormWizard({ mode }: { mode: 'create' | 'edit' }) {
  const isEdit = mode === 'edit';
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { currentTenantId, user } = useAuthStore();
  const tenantId = getTenantId(user, currentTenantId);
  const [error, setError] = useState<string | null>(null);
  const [dupMatches, setDupMatches] = useState<DuplicateMatchItem[] | null>(null);
  const [dupPayload, setDupPayload] = useState<Record<string, any> | null>(null);
  const [dupSaving, setDupSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [grades, setGrades] = useState<Array<{ name: string; amount: number }>>([]);
  const [areaOptions, setAreaOptions] = useState<string[]>([]);
  const [addGradeOpen, setAddGradeOpen] = useState(false);
  const [addAreaOpen, setAddAreaOpen] = useState(false);

  const form = useForm<FamilyFormData>({
    resolver: zodResolver(familySchema),
    mode: 'onTouched',
    defaultValues: {
      mahallId: '', varisangyaGrade: '', houseName: '', houseNameMl: '', familyHead: '', familyHeadMl: '', contactNo: '', wardNumber: '',
      houseNo: '', area: '', areaMl: '', place: '', placeMl: '', status: isEdit ? 'pending' : undefined, economicStatus: '', welfareStatus: '', housingType: '', specialRequirements: '',
    },
  });
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  const wizard = useFormWizard(form, STEPS);
  const draft = useFormDraft<FamilyFormData>(isEdit ? `family:edit:${id}` : 'family:create', form, {
    ready: !loading,
    onRestore: (s) => typeof s === 'number' && wizard.setStep(Math.min(s, STEPS.length - 1)),
  });
  const guard = useUnsavedChangesGuard(isDirty);
  const listPath = ROUTES.FAMILIES.LIST;

  useEffect(() => {
    if (!tenantId) return;
    tenantService
      .getById(tenantId)
      .then((tenant) => {
        setGrades(tenant.settings?.varisangyaGrades || []);
        setAreaOptions(tenant.settings?.areaOptions || ['Area A', 'Area B', 'Area C', 'Area D']);
      })
      .catch((err) => console.error('Error fetching tenant settings:', err));
  }, [tenantId]);

  useEffect(() => {
    if (!isEdit || !id) return;
    (async () => {
      try {
        setLoading(true);
        const family: any = await familyService.getById(id);
        reset({
          mahallId: family.mahallId || '',
          varisangyaGrade: family.varisangyaGrade || '',
          houseName: family.houseName,
          houseNameMl: family.houseNameMl || '',
          familyHead: family.familyHead || '',
          familyHeadMl: family.familyHeadMl || '',
          contactNo: family.contactNo || '',
          wardNumber: family.wardNumber || '',
          houseNo: family.houseNo || '',
          area: family.area || '',
          areaMl: family.areaMl || '',
          place: family.place || '',
          placeMl: family.placeMl || '',
          status: family.status || 'pending',
          economicStatus: family.economicStatus || '',
          welfareStatus: family.welfareStatus || '',
          housingType: family.housingType || '',
          specialRequirements: family.specialRequirements || '',
        });
      } catch (err: any) {
        setError(getFriendlyError(err, "Couldn't load family. Refresh the page or try again."));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit, reset]);

  const onSubmit = async (data: FamilyFormData) => {
    try {
      setError(null);
      // Strip empty strings from optional select fields to avoid enum validation errors
      const cleanedData = Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== '' && v !== undefined));
      if (isEdit) await familyService.update(id!, cleanedData);
      else await familyService.create(cleanedData);
      draft.clearDraft();
      navigate(listPath);
    } catch (err: any) {
      const dups = parseDuplicateError(err);
      if (dups) {
        setDupMatches(dups);
        setDupPayload(Object.fromEntries(Object.entries(data).filter(([_, v]) => v !== '' && v !== undefined)));
        return;
      }
      toast.error(getFriendlyError(err, `Couldn't ${isEdit ? 'update' : 'create'} the family. Check the details and try again.`));
      console.error('Error saving family:', err);
    }
  };

  const onInvalid = (errs: Record<string, unknown>) => {
    const i = wizard.stepOfFirstError(errs);
    if (i >= 0) wizard.setStep(i);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const gradeOptions = [
    { value: '', label: 'Select grade...' },
    ...grades.map((g) => ({ value: g.name, label: `${g.name} - ₹${g.amount}` })),
  ];
  const areaSelectOptions = [{ value: '', label: 'Select an area...' }, ...areaOptions.map((a) => ({ value: a, label: a }))];

  const v = watch();
  const show = (i: number) => (wizard.step === i ? undefined : true);

  return (
    <div className="space-y-4">
      <PageHeader
        title={isEdit ? 'Edit Family' : 'Create Family'}
        description={isEdit ? 'Update family information' : 'The family ID is generated automatically.'}
      />

      <Stepper steps={STEPS} current={wizard.step} maxVisited={wizard.maxVisited} onStepClick={wizard.goTo} />

      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (wizard.isLast) handleSubmit(onSubmit, onInvalid)(e);
          else wizard.next();
        }}
      >
        {draft.restored && <DraftAlert savedAt={draft.savedAt} onDiscard={draft.discardDraft} />}
        {error && <Alert tone="danger">{error}</Alert>}

        <div hidden={show(0)} className="space-y-4">
          <FormSection title="Family details" description="Who is the household?">
            {isEdit && (
              <Input label="Family ID (auto-generated)" {...register('mahallId')} disabled className="bg-[#F4F7F5] dark:bg-surface-raised" />
            )}
            <Select
              label="Varisangya grade"
              options={gradeOptions}
              value={v.varisangyaGrade || ''}
              onAddNew={tenantId ? () => setAddGradeOpen(true) : undefined}
              addNewLabel="Add Grade"
              {...register('varisangyaGrade')}
            />
            <Input label="House name" {...register('houseName')} error={errors.houseName?.message} required placeholder="e.g. Madathil" />
            <div className="hidden">
              <Input label="House name (Malayalam)" {...register('houseNameMl')} placeholder="വീട് പേര്" className="font-malayalam" />
            </div>
            <div className={isEdit ? undefined : 'hidden'}>
              <Input label="Family head" {...register('familyHead')} placeholder="Family head name" />
            </div>
            <div className="hidden">
              <Input label="Family head (Malayalam)" {...register('familyHeadMl')} placeholder="കുടുംബ നാഥൻ" className="font-malayalam" />
            </div>
            <PhoneInput label="Contact number" {...register('contactNo')} error={errors.contactNo?.message} />
            {isEdit && <Select label="Status" options={STATUS_OPTIONS} value={v.status || 'pending'} {...register('status')} />}
          </FormSection>
        </div>

        <div hidden={show(1)} className="space-y-4">
          <FormSection title="Address" description="Where the family lives">
            <Input label="Ward number" type="number" min={1} {...register('wardNumber')} error={errors.wardNumber?.message} placeholder="e.g. 4" />
            <Input label="House no." {...register('houseNo')} placeholder="House no." />
            <Select
              label="Area"
              options={areaSelectOptions}
              value={v.area || ''}
              onAddNew={tenantId ? () => setAddAreaOpen(true) : undefined}
              addNewLabel="Add Area"
              {...register('area')}
            />
            <div className="hidden">
              <Input label="Area (Malayalam)" {...register('areaMl')} placeholder="പ്രദേശം" className="font-malayalam" />
            </div>
            <Input label="Place" {...register('place')} placeholder="Place" />
            <div className="hidden">
              <Input label="Place (Malayalam)" {...register('placeMl')} placeholder="സ്ഥലം" className="font-malayalam" />
            </div>
          </FormSection>
        </div>

        <div hidden={show(2)} className="space-y-4">
          <FormSection title="Household status" description="Used for welfare and reports. Members are added after the family is created.">
            <Select label="Economic status" options={ECONOMIC_STATUS_OPTIONS} value={v.economicStatus || ''} {...register('economicStatus')} />
            <Select label="Welfare status" options={WELFARE_STATUS_OPTIONS} value={v.welfareStatus || ''} {...register('welfareStatus')} />
            <Select label="Housing type" options={HOUSING_TYPE_OPTIONS} value={v.housingType || ''} {...register('housingType')} />
            <Input label="Special requirements" {...register('specialRequirements')} placeholder="Anything the committee should know" />
          </FormSection>
        </div>

        {wizard.isLast && (
          <div className="space-y-4">
            <FormSection title="Review" description="Check everything before saving. Use Back or the steps above to change anything." columns={1}>
              <ReviewList
                items={[
                  { label: 'House name', value: v.houseName },
                  { label: 'Family head', value: v.familyHead },
                  { label: 'Contact number', value: v.contactNo },
                  { label: 'Varisangya grade', value: v.varisangyaGrade },
                  { label: 'Ward', value: v.wardNumber },
                  { label: 'House no.', value: v.houseNo },
                  { label: 'Area', value: v.area },
                  { label: 'Place', value: v.place },
                  { label: 'Economic status', value: labelOf(ECONOMIC_STATUS_OPTIONS, v.economicStatus) },
                  { label: 'Welfare status', value: labelOf(WELFARE_STATUS_OPTIONS, v.welfareStatus) },
                  { label: 'Housing type', value: labelOf(HOUSING_TYPE_OPTIONS, v.housingType) },
                  { label: 'Special requirements', value: v.specialRequirements },
                ]}
              />
            </FormSection>
          </div>
        )}

        <StickyActionBar
          stepText={`Step ${wizard.step + 1} of ${STEPS.length}`}
          dirty={isDirty}
          draftSaved={!!draft.savedAt}
          onCancel={() => guard.guardedNavigate(listPath)}
          onSaveDraft={() => draft.saveDraft(wizard.step)}
          onBack={wizard.isFirst ? undefined : wizard.back}
          onNext={wizard.next}
          nextLabel={`Next: ${STEPS[Math.min(wizard.step + 1, STEPS.length - 1)].label}`}
          isLast={wizard.isLast}
          submitLabel={isEdit ? 'Update family' : 'Create family'}
          isSubmitting={isSubmitting}
        />
      </form>

      <UnsavedChangesDialog guard={guard} />
      <DuplicateWarning
        open={!!dupMatches}
        entity="family"
        matches={dupMatches || []}
        isSaving={dupSaving}
        onCancel={() => setDupMatches(null)}
        onCreateAnyway={async () => {
          if (!dupPayload) return;
          try {
            setDupSaving(true);
            await familyService.create(dupPayload, { confirmDuplicate: true });
            draft.clearDraft();
            navigate(listPath);
          } catch (err: any) {
            setDupMatches(null);
            toast.error(getFriendlyError(err, "Couldn't create family. Check the details and try again."));
          } finally {
            setDupSaving(false);
          }
        }}
      />

      {tenantId && (
        <>
          <QuickAddVarisangyaGrade
            open={addGradeOpen}
            onClose={() => setAddGradeOpen(false)}
            tenantId={tenantId}
            onCreated={(grade) => {
              setGrades((prev) => [...prev, grade]);
              setValue('varisangyaGrade', grade.name, { shouldDirty: true });
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
              setValue('area', area, { shouldDirty: true });
            }}
          />
        </>
      )}
    </div>
  );
}
