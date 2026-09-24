import { z } from 'zod';

/** Zod fragment shared by the member create and edit schemas. */
export const socioEconomicSchemaFields = {
  occupation: z.string().optional(),
  occupationSector: z
    .enum([
      'government',
      'private',
      'self_employed',
      'abroad',
      'unemployed',
      'student',
      'homemaker',
      'retired',
      'none',
    ])
    .optional()
    .or(z.literal('')),
  monthlyIncomeRange: z
    .enum(['none', 'below_10k', '10k_25k', '25k_50k', 'above_50k'])
    .optional()
    .or(z.literal('')),
  skills: z.string().optional(),
  volunteerSkills: z.string().optional(),
  disabilityDetails: z.string().optional(),
  isJobSeeker: z.boolean().optional(),
  isZakatPayer: z.boolean().optional(),
  isZakatEligible: z.boolean().optional(),
  isWidow: z.boolean().optional(),
  hasDisability: z.boolean().optional(),
  isMarriageable: z.boolean().optional(),
  isVolunteer: z.boolean().optional(),
};

// Always an array (never undefined) so clearing the field actually clears it on edit
const toList = (value?: string): string[] =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const csv = (value?: string[] | string): string => (Array.isArray(value) ? value.join(', ') : value || '');

/** Form values -> API payload: comma strings become arrays, blanks are dropped. */
export const normalizeSocioEconomic = (data: Record<string, any>) => ({
  occupation: data.occupation || undefined,
  occupationSector: data.occupationSector || undefined,
  monthlyIncomeRange: data.monthlyIncomeRange || undefined,
  skills: toList(data.skills),
  volunteerSkills: toList(data.volunteerSkills),
  disabilityDetails: data.disabilityDetails || undefined,
  isJobSeeker: !!data.isJobSeeker,
  isZakatPayer: !!data.isZakatPayer,
  isZakatEligible: !!data.isZakatEligible,
  isWidow: !!data.isWidow,
  hasDisability: !!data.hasDisability,
  isMarriageable: !!data.isMarriageable,
  isVolunteer: !!data.isVolunteer,
});

/** API record -> form defaults for the edit form. */
export const socioEconomicDefaults = (member: Record<string, any>) => ({
  occupation: member.occupation || '',
  occupationSector: member.occupationSector || '',
  monthlyIncomeRange: member.monthlyIncomeRange || '',
  skills: csv(member.skills),
  volunteerSkills: csv(member.volunteerSkills),
  disabilityDetails: member.disabilityDetails || '',
  isJobSeeker: !!member.isJobSeeker,
  isZakatPayer: !!member.isZakatPayer,
  isZakatEligible: !!member.isZakatEligible,
  isWidow: !!member.isWidow,
  hasDisability: !!member.hasDisability,
  isMarriageable: !!member.isMarriageable,
  isVolunteer: !!member.isVolunteer,
});
