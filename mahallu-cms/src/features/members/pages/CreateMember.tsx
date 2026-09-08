import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiSave } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Alert from '@/components/ui/Alert';
import Checkbox from '@/components/ui/Checkbox';
import FormSection from '@/components/ui/FormSection';
import RadioCardGroup from '@/components/ui/RadioCardGroup';
import QuickAddFamily from '@/components/quick-add/QuickAddFamily';
import QuickAddTenantSetting from '@/components/quick-add/QuickAddTenantSetting';
import { ROUTES } from '@/constants/routes';
import SocioEconomicSection from '../components/SocioEconomicSection';
import { socioEconomicSchemaFields, normalizeSocioEconomic } from '../socioEconomicFields';
import { memberService } from '@/services/memberService';
import { familyService } from '@/services/familyService';
import { tenantService } from '@/services/tenantService';
import { instituteService } from '@/services/instituteService';
import { facilityService } from '@/services/surveyService';
import { Family } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { getTenantId as extractTenantId } from '@/utils/tenantHelper';
import { errorMessage } from '@/utils/errors';
import { toast } from '@/store/toastStore';
import PageHeader from '@/components/layout/PageHeader';

const memberSchema = z.object({
  name: z.string().max(200, 'Please keep the name to 200 characters or less.').min(1, 'Enter the member’s name'),
  nameMl: z.string().max(200, 'Please keep the name to 200 characters or less.').optional(),
  familyId: z.string().max(200, 'Please keep the family to 200 characters or less.').min(1, 'Choose a family'),
  familyName: z.string().max(200, 'Please keep the family name to 200 characters or less.').optional(),
  age: z.preprocess(
    (val) => (val === '' || Number.isNaN(val) ? undefined : val),
    z.number().min(0).max(150).optional()
  ),
  gender: z.enum(['male', 'female']).optional().or(z.literal('')),
  bloodGroup: z
    .enum(['A +ve', 'A -ve', 'B +ve', 'B -ve', 'AB +ve', 'AB -ve', 'O +ve', 'O -ve'])
    .optional()
    .or(z.literal('')),
  healthStatus: z.string().max(200, 'Please keep the health status to 200 characters or less.').optional(),
  phone: z
    .string()
    .optional()
    .refine((val) => !val || /^\d{10}$/.test(val), { message: 'Enter 10 digits' }),
  education: z.string().max(200, 'Please keep the education to 200 characters or less.').optional(),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional().or(z.literal('')),
  marriageCount: z.preprocess(
    (val) => (val === '' || Number.isNaN(val) ? undefined : val),
    z.number().min(0).optional()
  ),
  isOrphan: z.boolean().optional(),
  isDead: z.boolean().optional(),
  isFamilyHead: z.boolean().optional(),
  relationship: z
    .enum(['head', 'spouse', 'son', 'daughter', 'father', 'mother', 'other'])
    .optional()
    .or(z.literal('')),
  educationInstitutionId: z.string().max(200, 'Please keep the education institution to 200 characters or less.').optional(),
  localityFacilityId: z.string().max(200, 'Please keep the locality facility to 200 characters or less.').optional(),
  ...socioEconomicSchemaFields,
});

type MemberFormData = z.infer<typeof memberSchema>;

export default function CreateMember() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loadingFamilies, setLoadingFamilies] = useState(true);
  const [educationOptions, setEducationOptions] = useState<string[]>([]);
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [facilities, setFacilities] = useState<any[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [addFamilyOpen, setAddFamilyOpen] = useState(false);
  const [addEducationOpen, setAddEducationOpen] = useState(false);
  const [studyPlace, setStudyPlace] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
  });

  const selectedFamilyId = watch('familyId');
  const maritalStatus = watch('maritalStatus');
  const selectedFamily = families.find((f) => f.id === selectedFamilyId);
  const selectedFamilyName = selectedFamily?.houseName;

  useEffect(() => {
    fetchFamilies();
  }, []);

  useEffect(() => {
    if (selectedFamily) setValue('familyName', selectedFamily.houseName);
  }, [selectedFamily, setValue]);

  /* Warn before discarding a partly filled form. */
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDirty && !isSubmitting) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty, isSubmitting]);

  const fetchFamilies = async () => {
    try {
      setLoadingFamilies(true);
      const [familyResult, instituteResult, facilityResult] = await Promise.all([
        familyService.getAll(),
        instituteService.getAll(),
        facilityService.getAll(),
      ]);
      setFamilies(familyResult.data || []);
      setInstitutes(instituteResult.data || []);
      setFacilities(facilityResult.data || []);

      const { currentTenantId, user } = useAuthStore.getState();
      const tid = extractTenantId(user, currentTenantId);
      setTenantId(tid);
      if (tid) {
        try {
          const tenantData = await tenantService.getById(tid);
          setEducationOptions(
            tenantData.settings?.educationOptions || [
              'Below SSLC',
              'SSLC',
              'Plus Two',
              'Degree',
              'Diploma',
              'Post Graduation',
              'Doctorate',
              'MBBS',
            ]
          );
        } catch {
          // Falls back to the defaults above.
        }
      }
    } catch {
      setFamilies([]);
    } finally {
      setLoadingFamilies(false);
    }
  };

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
          marriageCount:
            data.marriageCount == null || Number.isNaN(data.marriageCount)
              ? undefined
              : Number(data.marriageCount),
          ...normalizeSocioEconomic(data),
        }).filter(([, v]) => v !== '' && v !== undefined && !(typeof v === 'number' && Number.isNaN(v)))
      );
      await memberService.create(memberData);
      // Creating a family toasts; creating a member used to navigate silently.
      toast.success('Member saved');
      navigate(ROUTES.MEMBERS.LIST);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'save this member' }));
    }
  };

  const handleCancel = () => {
    if (isDirty && !window.confirm('Discard this member? Anything you have entered will be lost.')) return;
    navigate(ROUTES.MEMBERS.LIST);
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
    { value: '', label: 'Not set' },
    { value: 'single', label: 'Single' },
    { value: 'married', label: 'Married' },
    { value: 'divorced', label: 'Divorced' },
    { value: 'widowed', label: 'Widowed' },
  ];

  const healthStatusOptions = [
    { value: '', label: 'Not set' },
    { value: 'healthy', label: 'Healthy' },
    { value: 'under_treatment', label: 'Under treatment' },
    { value: 'chronic', label: 'Chronic illness' },
    { value: 'disabled', label: 'Disabled' },
    { value: 'critical', label: 'Critical' },
    { value: 'recovering', label: 'Recovering' },
  ];

  const familyOptions = [
    { value: '', label: 'Choose a family' },
    ...families.map((family) => ({
      value: family.id,
      label: `${family.houseName}${family.mahallId ? ` (${family.mahallId})` : ''}`,
    })),
  ];

  return (
    <>
      <PageHeader
        title="New member"
        description="Only the family and the member’s name are required. Everything else can be added later."
        breadcrumbs={[{ label: 'Members', path: ROUTES.MEMBERS.LIST }]}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="pb-24">
        <Card padding="lg">
          {error && (
            <Alert variant="error" title="Couldn’t save this member" className="mb-4">
              {error}
            </Alert>
          )}

          {/* Required. Opens expanded; the rest of the form starts collapsed, so
              the ~30 fields no longer land on one screen. */}
          <FormSection
            title="Identity"
            description="Who this member is and which household they belong to."
            alwaysOpen
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Select
                  label="Family"
                  options={familyOptions}
                  value={watch('familyId') || ''}
                  onAddNew={() => setAddFamilyOpen(true)}
                  addNewLabel="Add family"
                  {...register('familyId')}
                  error={errors.familyId?.message}
                  required
                  disabled={loadingFamilies}
                />
              </div>

              {/* Derived from the chosen family — read-only text, not a disabled
                  required input carrying a red asterisk nobody can satisfy. */}
              {selectedFamilyName && (
                <div className="rounded-md border border-border bg-muted/40 px-3 py-2 md:col-span-2">
                  <p className="text-xs text-muted-foreground">Household</p>
                  <p className="text-sm font-medium text-foreground">{selectedFamilyName}</p>
                </div>
              )}

              {selectedFamilyId && (
                <div className="md:col-span-2">
                  <Checkbox
                    label="Family head"
                    {...register('isFamilyHead')}
                    disabled={Boolean(selectedFamily?.familyHead)}
                    helperText={
                      selectedFamily?.familyHead
                        ? `${selectedFamily.familyHead} is already the head of this family.`
                        : undefined
                    }
                  />
                </div>
              )}

              <Input
                label="Full name"
                {...register('name')}
                error={errors.name?.message}
                required
                placeholder="Ahmed Ali"
              />

              {/* The Malayalam name was hidden with `display: none` while still
                  registered and submitted. It is either part of the product or
                  it is not; the CSV importer and the loaded fonts say it is. */}
              <Input
                label="Name in Malayalam"
                {...register('nameMl')}
                placeholder="അഹമ്മദ് അലി"
                className="font-malayalam"
                helperText="Optional. Used on certificates printed in Malayalam."
              />

              <Input
                label="Age"
                type="number"
                {...register('age', { valueAsNumber: true })}
                error={errors.age?.message}
                min={0}
                max={150}
              />

              <Input
                label="Phone"
                type="tel"
                {...register('phone')}
                error={errors.phone?.message}
                placeholder="9876543210"
                maxLength={10}
              />

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
            </div>
          </FormSection>

          <FormSection
            title="Household and status"
            description="Relationship, marital status and health."
            hint="Optional"
            defaultOpen={false}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select
                label="Relationship to head"
                {...register('relationship')}
                options={[
                  { value: '', label: 'Not set' },
                  { value: 'head', label: 'Head' },
                  { value: 'spouse', label: 'Spouse' },
                  { value: 'son', label: 'Son' },
                  { value: 'daughter', label: 'Daughter' },
                  { value: 'father', label: 'Father' },
                  { value: 'mother', label: 'Mother' },
                  { value: 'other', label: 'Other' },
                ]}
              />
              <Select label="Marital status" {...register('maritalStatus')} options={maritalStatusOptions} />

              {/* Only asked when the marital status implies it. */}
              {maritalStatus && maritalStatus !== 'single' && (
                <Input
                  label="Number of marriages"
                  type="number"
                  min={0}
                  {...register('marriageCount', { valueAsNumber: true })}
                />
              )}

              <Select label="Health status" {...register('healthStatus')} options={healthStatusOptions} />

              <div className="md:col-span-2">
                <RadioCardGroup
                  label="Blood group"
                  options={bloodGroupOptions}
                  value={watch('bloodGroup') || ''}
                  onChange={(value) => setValue('bloodGroup', value as any)}
                  error={errors.bloodGroup?.message}
                  columns={4}
                />
              </div>

              {/* These two checkboxes were rendered twice, registering the same
                  fields twice. Labels read as language, not as booleans. */}
              <div className="flex flex-wrap items-center gap-6 md:col-span-2">
                <Checkbox label="Orphan" {...register('isOrphan')} />
                <Checkbox label="Deceased" {...register('isDead')} />
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Education"
            description="Qualification and where they study."
            hint="Optional"
            defaultOpen={false}
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select
                label="Qualification"
                {...register('education')}
                value={watch('education') || ''}
                onAddNew={tenantId ? () => setAddEducationOpen(true) : undefined}
                addNewLabel="Add qualification"
                options={[
                  { value: '', label: 'Not set' },
                  ...educationOptions.map((opt) => ({ value: opt, label: opt })),
                ]}
              />

              {/* One choice, then the matching field. The two "Studying at"
                  selects used to sit side by side and could both be filled. */}
              <Select
                label="Studying at"
                options={[
                  { value: '', label: 'Not studying' },
                  { value: 'institute', label: 'A mahallu institute' },
                  { value: 'external', label: 'An outside school or college' },
                ]}
                value={studyPlace}
                onChange={(e) => {
                  setStudyPlace(e.target.value);
                  setValue('educationInstitutionId', '');
                  setValue('localityFacilityId', '');
                }}
              />

              {studyPlace === 'institute' && (
                <div className="md:col-span-2">
                  <Select
                    label="Institute"
                    {...register('educationInstitutionId')}
                    options={[
                      { value: '', label: 'Select an institute' },
                      ...institutes.map((inst) => ({ value: inst.id || inst._id, label: inst.name })),
                    ]}
                  />
                </div>
              )}

              {studyPlace === 'external' && (
                <div className="md:col-span-2">
                  <Select
                    label="School or college"
                    {...register('localityFacilityId')}
                    options={[
                      { value: '', label: 'Select a facility' },
                      ...facilities.map((fac) => ({ value: fac.id, label: fac.name })),
                    ]}
                  />
                </div>
              )}
            </div>
          </FormSection>

          <FormSection
            title="Socio-economic details"
            description="Income, housing and welfare flags used by reports."
            hint="Optional"
            defaultOpen={false}
          >
            <SocioEconomicSection register={register} />
          </FormSection>
        </Card>

        {/* Actions stay in reach instead of sitting at the foot of a long scroll. */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 px-4 py-3 backdrop-blur md:pl-64">
          <div className="mx-auto flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-2 max-w-content sm:items-center">
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting} loadingText="Saving">
              <FiSave className="h-4 w-4" aria-hidden="true" />
              Save member
            </Button>
          </div>
        </div>
      </form>

      <QuickAddFamily
        open={addFamilyOpen}
        onClose={() => setAddFamilyOpen(false)}
        tenantId={tenantId}
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
    </>
  );
}
