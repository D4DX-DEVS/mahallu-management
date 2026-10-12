import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import Alert from '@/components/ui/Alert';
import DraftAlert from '@/components/ui/DraftAlert';
import PhotoUpload from '@/components/ui/PhotoUpload';
import FormSection, { ReviewList } from '@/components/ui/FormSection';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import PhoneInput from '@/components/ui/PhoneInput';
import RadioCardGroup from '@/components/ui/RadioCardGroup';
import Select from '@/components/ui/Select';
import Stepper from '@/components/ui/Stepper';
import StickyActionBar from '@/components/ui/StickyActionBar';
import UnsavedChangesDialog from '@/components/ui/UnsavedChangesDialog';
import QuickAddFamily from '@/components/quick-add/QuickAddFamily';
import QuickAddTenantSetting from '@/components/quick-add/QuickAddTenantSetting';
import { ROUTES } from '@/constants/routes';
import SocioEconomicSection from './SocioEconomicSection';
import { socioEconomicSchemaFields, normalizeSocioEconomic, socioEconomicDefaults } from '../socioEconomicFields';
import { memberService } from '@/services/memberService';
import { familyService, parseDuplicateError, DuplicateMatchItem } from '@/services/familyService';
import DuplicateWarning from '@/features/families/components/DuplicateWarning';
import { tenantService } from '@/services/tenantService';
import { Family } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { getTenantId as extractTenantId } from '@/utils/tenantHelper';
import { INDIAN_MOBILE_RE, PHONE_ERROR } from '@/utils/formFields';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useFormDraft } from '@/hooks/useFormDraft';
import { useFormWizard, WizardStep } from '@/hooks/useFormWizard';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const memberSchema = z.object({
  mahallId: z.string().optional(),
  name: z.string().trim().min(1, 'Enter the member name'),
  nameMl: z.string().optional(),
  familyId: z.string().min(1, 'Select a family'),
  familyName: z.string().min(1, 'Family name is required'),
  age: z.preprocess(
    (val) => (val === '' || Number.isNaN(val) ? undefined : val),
    z.number({ invalid_type_error: 'Enter age as a number' }).min(0, 'Age cannot be negative').max(150, 'Age must be 150 or less').optional()
  ),
  gender: z.enum(['male', 'female']).optional().or(z.literal('')),
  photoUrl: z.string().optional(),
  bloodGroup: z.enum(['A +ve', 'A -ve', 'B +ve', 'B -ve', 'AB +ve', 'AB -ve', 'O +ve', 'O -ve']).optional().or(z.literal('')),
  healthStatus: z.string().optional(),
  phone: z.string().optional().refine((val) => !val || INDIAN_MOBILE_RE.test(val), { message: PHONE_ERROR }),
  education: z.string().optional(),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional().or(z.literal('')),
  marriageCount: z.preprocess((val) => (val === '' || Number.isNaN(val) ? undefined : val), z.number().min(0).optional()),
  isOrphan: z.boolean().optional(),
  isDead: z.boolean().optional(),
  isFamilyHead: z.boolean().optional(),
  ...socioEconomicSchemaFields,
});

type MemberFormData = z.infer<typeof memberSchema>;

const STEPS: WizardStep<MemberFormData>[] = [
  { id: 'basics', label: 'Basics', fields: ['familyId', 'name', 'age', 'phone'] },
  { id: 'details', label: 'Details', fields: ['marriageCount'] },
  { id: 'community', label: 'Community', fields: [] },
  { id: 'review', label: 'Review', fields: [] },
];

const genderOptions = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];
const bloodGroupOptions = ['A +ve', 'A -ve', 'B +ve', 'B -ve', 'AB +ve', 'AB -ve', 'O +ve', 'O -ve'].map((b) => ({ value: b, label: b }));
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
const DEFAULT_EDUCATION = ['Below SSLC', 'SSLC', 'Plus Two', 'Degree', 'Diploma', 'Post Graduation', 'Doctorate', 'MBBS'];

const labelOf = (opts: { value: string; label: string }[], v?: string) => (v ? opts.find((o) => o.value === v)?.label || v : undefined);

const toNum = (v: unknown) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? undefined : Number(v));

const checkboxCls = 'h-4 w-4 cursor-pointer rounded border-line-strong accent-primary-700 dark:accent-brand-lime';

/** Shared 4-step wizard for creating and editing a member (Basics > Details > Community > Review). */
export default function MemberFormWizard({ mode }: { mode: 'create' | 'edit' }) {
  const isEdit = mode === 'edit';
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);
  const [dupMatches, setDupMatches] = useState<DuplicateMatchItem[] | null>(null);
  const [dupPayload, setDupPayload] = useState<Record<string, any> | null>(null);
  const [dupSaving, setDupSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loadingFamilies, setLoadingFamilies] = useState(true);
  const [educationOptions, setEducationOptions] = useState<string[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [addFamilyOpen, setAddFamilyOpen] = useState(false);
  const [addEducationOpen, setAddEducationOpen] = useState(false);

  const form = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
    mode: 'onTouched',
    defaultValues: {
      mahallId: '', name: '', nameMl: '', familyId: '', familyName: '', age: undefined, marriageCount: undefined, gender: '', bloodGroup: '', healthStatus: '', phone: '', education: '',
      maritalStatus: '', isOrphan: false, isDead: false, isFamilyHead: false, ...socioEconomicDefaults({}),
    } as any,
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
  const draft = useFormDraft<MemberFormData>(isEdit ? `member:edit:${id}` : 'member:create', form, {
    ready: !loading,
    onRestore: (s) => typeof s === 'number' && wizard.setStep(Math.min(s, STEPS.length - 1)),
  });
  const guard = useUnsavedChangesGuard(isDirty);
  const listPath = ROUTES.MEMBERS.LIST;

  const selectedFamilyId = watch('familyId');
  const selectedFamily = families.find((f) => f.id === selectedFamilyId);

  useEffect(() => {
    (async () => {
      try {
        setLoadingFamilies(true);
        const result = await familyService.getAll();
        setFamilies(result.data || []);
      } catch (err) {
        console.error('Error fetching families:', err);
        setFamilies([]);
      } finally {
        setLoadingFamilies(false);
      }
      const { currentTenantId, user } = useAuthStore.getState();
      const tid = extractTenantId(user, currentTenantId);
      setTenantId(tid);
      if (tid) {
        try {
          const tenantData = await tenantService.getById(tid);
          setEducationOptions(tenantData.settings?.educationOptions || DEFAULT_EDUCATION);
        } catch (err) {
          console.error('Failed to fetch education options:', err);
        }
      }
    })();
  }, []);

  useEffect(() => {
    if (!isEdit && selectedFamily) setValue('familyName', selectedFamily.houseName);
    if (isEdit && selectedFamily && selectedFamily.houseName) setValue('familyName', selectedFamily.houseName);
  }, [selectedFamily, setValue, isEdit]);

  useEffect(() => {
    if (!isEdit || !id) return;
    (async () => {
      try {
        setLoading(true);
        const member: any = await memberService.getById(id);
        reset({
          name: member.name,
          nameMl: member.nameMl || '',
          familyId: member.familyId,
          familyName: member.familyName,
          mahallId: member.mahallId || '',
          age: member.age || undefined,
          gender: member.gender || '',
          bloodGroup: member.bloodGroup || '',
          photoUrl: member.photoUrl || '',
          healthStatus: member.healthStatus || '',
          phone: member.phone || '',
          education: member.education || '',
          maritalStatus: member.maritalStatus || '',
          marriageCount: member.marriageCount ?? undefined,
          isOrphan: Boolean(member.isOrphan),
          isDead: Boolean(member.isDead),
          ...socioEconomicDefaults(member),
        } as any);
      } catch (err: any) {
        setError(getFriendlyError(err, "Couldn't load member. Refresh the page or try again."));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit, reset]);

  const memberData_ref = useRef<Record<string, any>>({});
  const onSubmit = async (data: MemberFormData) => {
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
      // an explicit '' clears a removed photo (empty values are otherwise dropped above)
      if (isEdit && data.photoUrl === '') (memberData as any).photoUrl = '';
      memberData_ref.current = memberData;
      if (isEdit) await memberService.update(id!, memberData);
      else await memberService.create(memberData);
      draft.clearDraft();
      navigate(listPath);
    } catch (err: any) {
      const dups = parseDuplicateError(err);
      if (dups) {
        setDupMatches(dups);
        setDupPayload(memberData_ref.current);
        return;
      }
      toast.error(getFriendlyError(err, `Couldn't ${isEdit ? 'update' : 'create'} the member. Check the details and try again.`));
      console.error('Error saving member:', err);
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

  const familyOptions = [
    { value: '', label: 'Select family...' },
    ...families.map((f) => ({ value: f.id, label: `${f.houseName}${f.mahallId ? ` (${f.mahallId})` : ''}` })),
  ];
  const educationSelectOptions = [{ value: '', label: 'Select Education' }, ...educationOptions.map((o) => ({ value: o, label: o }))];
  const v = watch();
  const show = (i: number) => (wizard.step === i ? undefined : true);
  const flags = [
    v.isFamilyHead && 'Family head',
    v.isOrphan && 'Orphan',
    v.isDead && 'Deceased',
    v.isJobSeeker && 'Job seeker',
    v.isZakatPayer && 'Zakat payer',
    v.isZakatEligible && 'Zakat eligible',
    v.isWidow && 'Widow',
    v.hasDisability && 'Has disability',
    v.isMarriageable && 'Open to proposals',
    v.isVolunteer && 'Volunteer',
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      <PageHeader
        title={isEdit ? 'Edit Member' : 'Create Member'}
        description={isEdit ? 'Update member information' : 'Add a new family member with complete information'}
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
          <FormSection title="Basic information" description="Family, name and contact details">
            <div className="md:col-span-2">
              <PhotoUpload name={v.name} value={v.photoUrl} onChange={(url) => setValue('photoUrl', url, { shouldDirty: true })} />
            </div>
            <Select
              label="Family"
              options={familyOptions}
              value={v.familyId || ''}
              onAddNew={isEdit ? undefined : () => setAddFamilyOpen(true)}
              addNewLabel="Add Family"
              {...register('familyId')}
              error={errors.familyId?.message}
              required
              disabled={loadingFamilies}
              className="md:col-span-2"
            />
            {!isEdit && selectedFamilyId && (
              <div className="md:col-span-2">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-[#3A4741] dark:text-surface-text">
                  <input type="checkbox" {...register('isFamilyHead')} disabled={!!selectedFamily?.familyHead} className={checkboxCls} />
                  Is family head
                </label>
                {selectedFamily?.familyHead && (
                  <p className="mt-1 text-xs text-[#7A5B00] dark:text-secondary-300">
                    This family already has a head: <strong>{selectedFamily.familyHead}</strong>. Cannot assign another.
                  </p>
                )}
              </div>
            )}
            <Input label="Family name" {...register('familyName')} error={errors.familyName?.message} required disabled className="md:col-span-2" />
            <Input label="Member name" {...register('name')} error={errors.name?.message} required placeholder="Full name" />
            <div className="hidden">
              <Input label="Member name (Malayalam)" {...register('nameMl')} placeholder="പേര്" className="font-malayalam" />
            </div>
            {isEdit && <Input label="Member ID (auto-generated)" {...register('mahallId')} disabled className="bg-[#F4F7F5] dark:bg-surface-raised" />}
            <Input
              label="Age"
              type="number"
              {...register('age', { setValueAs: toNum })}
              error={errors.age?.message}
              placeholder="Age in years"
              min={0}
              max={150}
            />
            <PhoneInput label="Phone" {...register('phone')} error={errors.phone?.message} />
            <div className="md:col-span-2">
              <RadioCardGroup
                label="Gender"
                options={genderOptions}
                value={v.gender || ''}
                onChange={(value) => setValue('gender', value as 'male' | 'female', { shouldDirty: true })}
                error={errors.gender?.message}
                columns={2}
              />
            </div>
            <div className="md:col-span-2">
              <RadioCardGroup
                label="Blood group"
                options={bloodGroupOptions}
                value={v.bloodGroup || ''}
                onChange={(value) => setValue('bloodGroup', value as any, { shouldDirty: true })}
                error={errors.bloodGroup?.message}
                columns={4}
              />
            </div>
          </FormSection>
        </div>

        <div hidden={show(1)} className="space-y-4">
          <FormSection title="Health and personal details" description="Optional, helps welfare and marriage records">
            <Select label="Health status" {...register('healthStatus')} value={v.healthStatus || ''} options={healthStatusOptions} className="md:col-span-2" />
            <Select
              label="Education"
              {...register('education')}
              value={v.education || ''}
              onAddNew={tenantId ? () => setAddEducationOpen(true) : undefined}
              addNewLabel="Add Education"
              options={educationSelectOptions}
              className="md:col-span-2"
            />
            <Select label="Marital status" {...register('maritalStatus')} value={v.maritalStatus || ''} options={maritalStatusOptions} />
            <Input
              label="Number of marriages"
              type="number"
              min={0}
              {...register('marriageCount', { setValueAs: toNum })}
              error={errors.marriageCount?.message as string | undefined}
              placeholder="0"
            />
            <div className="flex items-center gap-4 md:col-span-2">
              <label className="flex items-center gap-2 text-sm text-[#3A4741] dark:text-surface-text">
                <input type="checkbox" {...register('isOrphan')} className={checkboxCls} />
                Is orphan
              </label>
              <label className="flex items-center gap-2 text-sm text-[#3A4741] dark:text-surface-text">
                <input type="checkbox" {...register('isDead')} className={checkboxCls} />
                Is deceased
              </label>
            </div>
          </FormSection>
        </div>

        <div hidden={show(2)} className="space-y-4">
          <SocioEconomicSection register={register} defaultOpen />
        </div>

        {wizard.isLast && (
          <FormSection title="Review" description="Check everything before saving. Use Back or the steps above to change anything." columns={1}>
            <ReviewList
              items={[
                { label: 'Family', value: v.familyName },
                { label: 'Member name', value: v.name },
                { label: 'Age', value: v.age === undefined || Number.isNaN(v.age as number) ? undefined : String(v.age) },
                { label: 'Gender', value: labelOf(genderOptions, v.gender) },
                { label: 'Blood group', value: v.bloodGroup },
                { label: 'Phone', value: v.phone },
                { label: 'Health status', value: labelOf(healthStatusOptions, v.healthStatus) },
                { label: 'Education', value: v.education },
                { label: 'Marital status', value: labelOf(maritalStatusOptions, v.maritalStatus) },
                { label: 'Occupation', value: v.occupation },
                { label: 'Skills', value: v.skills },
                { label: 'Flags', value: flags.join(', ') },
              ]}
            />
          </FormSection>
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
          submitLabel={isEdit ? 'Update member' : 'Create member'}
          isSubmitting={isSubmitting}
        />
      </form>

      <UnsavedChangesDialog guard={guard} />
      <DuplicateWarning
        open={!!dupMatches}
        entity="member"
        matches={dupMatches || []}
        isSaving={dupSaving}
        onCancel={() => setDupMatches(null)}
        onCreateAnyway={async () => {
          if (!dupPayload) return;
          try {
            setDupSaving(true);
            await memberService.create(dupPayload, { confirmDuplicate: true });
            draft.clearDraft();
            navigate(listPath);
          } catch (err: any) {
            setDupMatches(null);
            toast.error(getFriendlyError(err, "Couldn't create member. Check the details and try again."));
          } finally {
            setDupSaving(false);
          }
        }}
      />

      {!isEdit && (
        <QuickAddFamily
          open={addFamilyOpen}
          onClose={() => setAddFamilyOpen(false)}
          tenantId={tenantId}
          onCreated={(newFamily) => {
            setFamilies((prev) => [...prev, { id: newFamily.id, houseName: newFamily.label } as Family]);
            setValue('familyId', newFamily.id, { shouldValidate: true, shouldDirty: true });
            setValue('familyName', newFamily.label);
          }}
        />
      )}

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
            setValue('education', edu, { shouldDirty: true });
          }}
        />
      )}
    </div>
  );
}
