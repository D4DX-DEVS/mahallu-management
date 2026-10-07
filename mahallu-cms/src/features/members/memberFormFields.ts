import { z } from 'zod';

/** Relationship code that opens the free-text "specify" box. */
export const OTHER_RELATIONSHIP = 'other';
/** Health status code that means "nothing to describe". */
export const HEALTHY_STATUS = 'healthy';
/** Health status code under which disability details are captured. */
export const DISABLED_STATUS = 'disabled';
/** Education dropdown code that opens the free-text "specify" box. */
export const OTHER_EDUCATION = 'other';

export const isOtherEducation = (education?: string) => education === OTHER_EDUCATION;

export const isOtherRelationship = (relationship?: string) => relationship === OTHER_RELATIONSHIP;

/** A blank status has nothing to describe yet; anything other than 'healthy' does. */
export const needsHealthNotes = (healthStatus?: string) => !!healthStatus && healthStatus !== HEALTHY_STATUS;

/**
 * Disability details used to live in the socio-economic card. They now belong
 * to the one free-text health box, which relabels itself so 'Disabled' still
 * reads as the place to describe the disability.
 */
export const healthNotesCopy = (healthStatus?: string) =>
  healthStatus === DISABLED_STATUS
    ? {
        label: 'Disability Details',
        placeholder: 'Nature of the disability, aids or support needed',
        helperText: 'Optional - feeds the disability register and welfare screening',
      }
    : {
        label: 'Health Issue Details',
        placeholder: 'Describe the condition, treatment or support needed',
        helperText: 'Optional - helps welfare and medical screening',
      };

/**
 * Age in completed years, or undefined when the date is missing/unparseable.
 *
 * The picker hands back 'YYYY-MM-DD', which `new Date()` would read as UTC
 * midnight - 05:30 local in IST, so a birth recorded early that morning would
 * look like it is in the future. Parsed as a local date instead.
 */
export const calculateAge = (dateOfBirth?: string): number | undefined => {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec((dateOfBirth || '').trim());
  if (!dateOnly) return undefined;

  const dob = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]));
  if (Number.isNaN(dob.getTime())) return undefined;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age < 0 ? undefined : age;
};

/** Bounds the DOB picker's year dropdown. Stable identities so DayPicker isn't handed new Dates every render. */
export const EARLIEST_DOB = new Date(new Date().getFullYear() - 150, 0, 1);
export const LATEST_DOB = new Date();

/** Zod fragment shared by the member create and edit schemas. */
export const conditionalSchemaFields = {
  dateOfBirth: z.string().optional(),
  healthNotes: z.string().max(500, 'Health details must be 500 characters or less').optional(),
  relationshipOther: z.string().max(100, 'Relationship must be 100 characters or less').optional(),
  educationOther: z.string().max(200, 'Qualification must be 200 characters or less').optional(),
  externalInstitution: z.string().max(200, 'Please keep this to 200 characters or less').optional(),
};

/**
 * Makes the free-text box mandatory once the dropdown that reveals it is on
 * 'other'. Health details stay optional: an admin can know someone is under
 * treatment without knowing what for.
 */
export const withConditionalRules = <T extends z.ZodTypeAny>(schema: T) =>
  schema.superRefine((data: any, ctx: z.RefinementCtx) => {
    if (isOtherRelationship(data.relationship) && !data.relationshipOther?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['relationshipOther'],
        message: 'Please specify the relationship',
      });
    }
  });

/**
 * Form values -> API payload. Empty strings (rather than undefined) so the
 * server clears a stale value when the driving dropdown moves away from the
 * branch that revealed the box.
 */
export const normalizeConditionalFields = (data: Record<string, any>) => ({
  dateOfBirth: data.dateOfBirth || undefined,
  relationshipOther: isOtherRelationship(data.relationship) ? data.relationshipOther?.trim() || '' : '',
  healthNotes: needsHealthNotes(data.healthStatus) ? data.healthNotes?.trim() || '' : '',
  education: isOtherEducation(data.education) ? data.educationOther?.trim() || '' : data.education,
  educationOther: isOtherEducation(data.education) ? data.educationOther?.trim() || '' : '',
});

/** API record -> form defaults for the edit form. */
export const conditionalDefaults = (member: Record<string, any>) => ({
  // <input type="date"> / DatePicker want 'YYYY-MM-DD', the API sends an ISO timestamp
  dateOfBirth: member.dateOfBirth ? String(member.dateOfBirth).slice(0, 10) : '',
  relationshipOther: member.relationshipOther || '',
  // Falls back to the retired socio-economic field so text captured there
  // still surfaces (and gets re-saved) in its new home.
  healthNotes: member.healthNotes || member.disabilityDetails || '',
  educationOther: member.educationOther || '',
  externalInstitution: member.externalInstitution || '',
});
