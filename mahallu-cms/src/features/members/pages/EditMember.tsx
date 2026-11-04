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
import Alert from '@/components/ui/Alert';
import Checkbox from '@/components/ui/Checkbox';
import FormSection from '@/components/ui/FormSection';
import RadioCardGroup from '@/components/ui/RadioCardGroup';
import DatePicker from '@/components/ui/DatePicker';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/constants/routes';
import SocioEconomicSection from '../components/SocioEconomicSection';
import {
  socioEconomicSchemaFields,
  normalizeSocioEconomic,
  socioEconomicDefaults,
} from '../socioEconomicFields';
import {
  conditionalSchemaFields,
  withConditionalRules,
  normalizeConditionalFields,
  conditionalDefaults,
  isOtherRelationship,
  isOtherEducation,
  needsHealthNotes,
  healthNotesCopy,
  calculateAge,
  EARLIEST_DOB,
  LATEST_DOB,
} from '../memberFormFields';
import { memberService } from '@/services/memberService';
import { familyService } from '@/services/familyService';
import { tenantService } from '@/services/tenantService';
import { instituteService } from '@/services/instituteService';
import { fetchAllPages } from '@/services/api';
import { Family } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { getTenantId as extractTenantId } from '@/utils/tenantHelper';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import { toast } from '@/store/toastStore';
import { sanitizeDigits } from '@/utils/validation';

const memberSchemaShape = z.object({
  name: z.string().max(200, 'Please keep the name to 200 characters or less.').min(1, 'Name is required'),
  nameMl: z.string().max(200, 'Please keep the name to 200 characters or less.').optional(),
  familyId: z.string().max(200, 'Please keep the family to 200 characters or less.').min(1, 'Family is required'),
  familyName: z.string().max(200, 'Please keep the family name to 200 characters or less.').min(1, 'Family Name is required'),
  mahallId: z.string().max(200, 'Please keep the mahall to 200 characters or less.').optional(),
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
    .refine((val) => !val || /^\d{10}$/.test(val), { message: 'Phone number must be exactly 10 digits' }),
  education: z.string().max(200, 'Please keep the education to 200 characters or less.').optional(),
  maritalStatus: z.enum(['single', 'married', 'divorced', 'widowed']).optional().or(z.literal('')),
  marriageCount: z.preprocess(
    (val) => (val === '' || Number.isNaN(val) ? undefined : val),
    z.number().min(0).optional()
  ),
  isOrphan: z.boolean().optional(),
  isDead: z.boolean().optional(),
  relationship: z
    .enum(['head', 'spouse', 'son', 'daughter', 'father', 'mother', 'other'])
    .optional()
    .or(z.literal('')),
  educationInstitutionId: z.string().max(200, 'Please keep the education institution to 200 characters or less.').optional(),
  localityFacilityId: z.string().max(200, 'Please keep the locality facility to 200 characters or less.').optional(),
  ...socioEconomicSchemaFields,
  ...conditionalSchemaFields,
});

const memberSchema = withConditionalRules(memberSchemaShape);

// Inferred off the plain object shape (not the superRefine wrapper) so the
// concrete object type survives — resolving it off the wrapped ZodEffects
// schema degrades every `errors.<field>` to a loose FieldErrorsImpl union.
type MemberFormData = z.infer<typeof memberSchemaShape>;

const DEFAULT_EDUCATION_OPTIONS = [
  'Below SSLC',
  'SSLC',
  'Plus Two',
  'Degree',
  'Diploma',
  'Post Graduation',
  'Doctorate',
  'MBBS',
];

const loadEducationOptions = async (): Promise<string[]> => {
  const { currentTenantId, user } = useAuthStore.getState();
  const tenantId = extractTenantId(user, currentTenantId);
  if (!tenantId) return DEFAULT_EDUCATION_OPTIONS;
  try {
    const tenantData = await tenantService.getById(tenantId);
    return tenantData.settings?.educationOptions || DEFAULT_EDUCATION_OPTIONS;
  } catch (err) {
    console.error("Couldn't load education options:", err);
    return DEFAULT_EDUCATION_OPTIONS;
  }
};

const genderOptions = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
];

const bloodGroupOptions = ['A +ve', 'A -ve', 'B +ve', 'B -ve', 'AB +ve', 'AB -ve', 'O +ve', 'O -ve'].map((group) => ({
  value: group,
  label: group,
}));

const relationshipOptions = [
  { value: '', label: 'Not set' },
  { value: 'head', label: 'Head' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'son', label: 'Son' },
  { value: 'daughter', label: 'Daughter' },
  { value: 'father', label: 'Father' },
  { value: 'mother', label: 'Mother' },
  { value: 'other', label: 'Other' },
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

export default function EditMember() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingLists, setLoadingLists] = useState(true);
  const [educationOptions, setEducationOptions] = useState<string[]>([]);
  const [families, setFamilies] = useState<Family[]>([]);
  const [institutes, setInstitutes] = useState<any[]>([]);
  const [memberFamily, setMemberFamily] = useState<{ id: string; name: string } | null>(null);
  const [studyPlace, setStudyPlace] = useState('');

  const {
    register,
    handleSubmit,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
  });

  const selectedFamilyId = watch('familyId');
  const relationship = watch('relationship');
  const maritalStatus = watch('maritalStatus');
  const healthStatus = watch('healthStatus');
  const education = watch('education');
  const dateOfBirth = watch('dateOfBirth');

  /* The member and the tenant's education options are enough to paint the
   * form, so they are awaited together. The family / institute lists can be
   * hundreds of rows over several pages and load on their own below. */
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const [member, options] = await Promise.all([memberService.getById(id), loadEducationOptions()]);
        if (cancelled) return;

        // A qualification typed under "Other" is stored as plain text; show it
        // back under "Other" instead of an empty dropdown.
        const customEducation = !!member.education && !options.includes(member.education);
        const conditional = conditionalDefaults(member);
        setEducationOptions(options);
        setMemberFamily({ id: member.familyId, name: member.familyName });
        setStudyPlace(member.educationInstitutionId ? 'institute' : member.externalInstitution ? 'external' : '');

        reset({
          name: member.name,
          nameMl: member.nameMl || '',
          familyId: member.familyId,
          familyName: member.familyName,
          mahallId: member.mahallId || '',
          age: member.age ?? undefined,
          gender: member.gender || '',
          bloodGroup: (member.bloodGroup || '') as MemberFormData['bloodGroup'],
          healthStatus: member.healthStatus || '',
          phone: member.phone || '',
          maritalStatus: member.maritalStatus || '',
          marriageCount: member.marriageCount ?? undefined,
          isOrphan: Boolean(member.isOrphan),
          isDead: Boolean(member.isDead),
          relationship: member.relationship || '',
          educationInstitutionId: member.educationInstitutionId || '',
          ...socioEconomicDefaults(member),
          ...conditional,
          education: customEducation ? 'other' : member.education || '',
          educationOther: customEducation ? conditional.educationOther || member.education : conditional.educationOther,
        });
      } catch (err: any) {
        if (!cancelled) setError(loadErrorMessage(err, 'member'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, reset]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Every family and institute, not just the API's default page of 10 of each.
        const [allFamilies, allInstitutes] = await Promise.all([
          fetchAllPages((p) => familyService.getAll(p)),
          fetchAllPages((p) => instituteService.getAll(p)),
        ]);
        if (cancelled) return;
        setFamilies(allFamilies);
        setInstitutes(allInstitutes);
      } catch (err) {
        console.error('Error fetching families:', err);
      } finally {
        if (!cancelled) setLoadingLists(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (selectedFamilyId) {
      const selectedFamily = families.find((f) => f.id === selectedFamilyId);
      if (selectedFamily) {
        setValue('familyName', selectedFamily.houseName);
      }
    }
  }, [selectedFamilyId, families, setValue]);

  /* Age becomes a derived, read-only value once a date of birth is set. */
  useEffect(() => {
    const derivedAge = calculateAge(dateOfBirth);
    if (derivedAge !== undefined) setValue('age', derivedAge, { shouldValidate: true });
  }, [dateOfBirth, setValue]);

  const onSubmit = async (data: MemberFormData) => {
    if (!id) return;
    try {
      setError(null);
      const memberData = {
        ...Object.fromEntries(
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
          }).filter(([_, v]) => v !== '' && v !== undefined && !(typeof v === 'number' && Number.isNaN(v)))
        ),
        // Kept out of the filter above: relationshipOther/healthNotes send ''
        // (not undefined) so the server clears a stale value, per normalizeConditionalFields.
        ...normalizeConditionalFields(data),
      };
      await memberService.update(id, memberData);
      toast.success('Member updated');
      navigate(ROUTES.MEMBERS.LIST);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'update member. please try again' }));
      console.error('Error updating member:', err);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  /* The member already carries its own family, so it is offered immediately
   * rather than leaving the dropdown blank until the full list has loaded. */
  const familyListed = families.some((family) => family.id === memberFamily?.id);
  const familyOptions = [
    { value: '', label: 'Choose a family' },
    ...(memberFamily && !familyListed ? [{ value: memberFamily.id, label: toTitleCase(memberFamily.name) }] : []),
    ...families.map((family) => ({
      value: family.id,
      label: `${toTitleCase(family.houseName)}${family.mahallId ? ` (${family.mahallId})` : ''}`,
    })),
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Edit Member"
        description="Update member information"
        breadcrumbs={[{ label: 'Members', path: ROUTES.MEMBERS.LIST }]}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card padding="lg">
          {error && (
            <Alert variant="error" title="Couldn’t update this member" className="mb-4">
              {error}
            </Alert>
          )}

          <FormSection
            title="Identity"
            description="Who this member is and which household they belong to."
            alwaysOpen
          >
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select
                label="Family"
                options={familyOptions}
                value={watch('familyId') || ''}
                {...register('familyId')}
                error={errors.familyId?.message}
                required
              />
              {/* Follows the chosen family; kept in the form for the API, not asked for. */}
              <input type="hidden" {...register('familyName')} />
              <Input
                label="Member ID"
                {...register('mahallId')}
                placeholder="Member ID"
                helperText="Generated automatically."
                disabled
              />

              <Input
                label="Full name"
                {...register('name')}
                error={errors.name?.message}
                required
                placeholder="Ahmed Ali"
              />
              <Input
                label="Name in Malayalam"
                {...register('nameMl')}
                placeholder="അഹമ്മദ് അലി"
                className="font-malayalam"
                helperText="Optional. Used on certificates printed in Malayalam."
              />

              <DatePicker
                label="Date of birth"
                value={dateOfBirth || ''}
                onChange={(value) => setValue('dateOfBirth', value, { shouldValidate: true, shouldDirty: true })}
                error={errors.dateOfBirth?.message}
                helperText="Age is calculated automatically once this is set."
                captionLayout="dropdown"
                minDate={EARLIEST_DOB}
                maxDate={LATEST_DOB}
                startMonth={EARLIEST_DOB}
                endMonth={LATEST_DOB}
              />
              <Input
                label="Age"
                type="number"
                {...register('age', { valueAsNumber: true })}
                error={errors.age?.message}
                min={0}
                max={150}
                disabled={!!dateOfBirth}
                helperText={dateOfBirth ? 'Calculated from date of birth.' : undefined}
              />

              <Input
                label="Phone"
                type="tel"
                inputMode="numeric"
                {...register('phone')}
                onChange={(e) => setValue('phone', sanitizeDigits(e.target.value, 10), { shouldValidate: true, shouldDirty: true })}
                error={errors.phone?.message}
                placeholder="9876543210"
                maxLength={10}
              />
              <RadioCardGroup
                label="Gender"
                options={genderOptions}
                value={watch('gender') || ''}
                onChange={(value) => setValue('gender', value as 'male' | 'female', { shouldDirty: true })}
                error={errors.gender?.message}
                columns={2}
              />
            </div>
          </FormSection>

          <FormSection title="Household and status" description="Relationship, marital status and health.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select
                label="Relationship to head"
                value={relationship || ''}
                {...register('relationship')}
                options={relationshipOptions}
              />
              <Select
                label="Marital status"
                value={maritalStatus || ''}
                {...register('maritalStatus')}
                options={maritalStatusOptions}
              />

              {/* Only asked when the relationship dropdown is on 'other'. */}
              {isOtherRelationship(relationship) && (
                <Input
                  label="Relationship (specify)"
                  {...register('relationshipOther')}
                  error={errors.relationshipOther?.message}
                  required
                  placeholder="e.g. Grandmother"
                />
              )}

              {/* Only asked when the marital status implies it. */}
              {maritalStatus && maritalStatus !== 'single' && (
                <Input
                  label="Number of marriages"
                  type="number"
                  min={0}
                  {...register('marriageCount', { valueAsNumber: true })}
                  placeholder="0"
                />
              )}

              <Select
                label="Health status"
                value={healthStatus || ''}
                {...register('healthStatus')}
                options={healthStatusOptions}
              />

              {/* Only asked when the health status isn't 'healthy'; relabels itself for 'disabled'. */}
              {needsHealthNotes(healthStatus) && (
                <div className="md:col-span-2">
                  <Input
                    label={healthNotesCopy(healthStatus).label}
                    {...register('healthNotes')}
                    error={errors.healthNotes?.message}
                    placeholder={healthNotesCopy(healthStatus).placeholder}
                    helperText={healthNotesCopy(healthStatus).helperText}
                  />
                </div>
              )}

              <div className="md:col-span-2">
                <RadioCardGroup
                  label="Blood group"
                  options={bloodGroupOptions}
                  value={watch('bloodGroup') || ''}
                  onChange={(value) => setValue('bloodGroup', value as MemberFormData['bloodGroup'], { shouldDirty: true })}
                  error={errors.bloodGroup?.message}
                  columns={8}
                />
              </div>

              <div className="flex flex-wrap items-center gap-x-6 md:col-span-2">
                <Checkbox label="Orphan" {...register('isOrphan')} />
                <Checkbox label="Deceased" {...register('isDead')} />
              </div>
            </div>
          </FormSection>

          <FormSection title="Education" description="Qualification and where they study.">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select
                label="Qualification"
                value={education || ''}
                {...register('education')}
                options={[
                  { value: '', label: 'Not set' },
                  ...educationOptions.map((opt) => ({ value: opt, label: opt })),
                  { value: 'other', label: 'Other' },
                ]}
              />

              {/* Only asked when the qualification dropdown is on 'other'. */}
              {isOtherEducation(education) && (
                <Input
                  label="Qualification (specify)"
                  {...register('educationOther')}
                  error={errors.educationOther?.message}
                  placeholder="e.g. B.Tech, M.A."
                />
              )}

              {/* One choice, then the matching field. */}
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
                  setValue('externalInstitution', '');
                }}
              />

              {studyPlace === 'institute' && (
                <Select
                  label="Institute"
                  value={watch('educationInstitutionId') || ''}
                  {...register('educationInstitutionId')}
                  disabled={loadingLists}
                  options={[
                    { value: '', label: 'Select an institute' },
                    ...institutes.map((inst) => ({ value: inst.id || inst._id, label: toTitleCase(inst.name) })),
                  ]}
                />
              )}

              {studyPlace === 'external' && (
                <Input
                  label="School or college"
                  {...register('externalInstitution')}
                  error={errors.externalInstitution?.message}
                  placeholder="Name of the school or college"
                />
              )}
            </div>
          </FormSection>

          <FormSection title="Socio-economic details" description="Income, housing and welfare flags used by reports.">
            <SocioEconomicSection register={register} watch={watch} />
          </FormSection>

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.MEMBERS.LIST)}>
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
