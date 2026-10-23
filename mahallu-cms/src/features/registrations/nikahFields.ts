import { z } from 'zod';

/** The stored values for the mahr type; the labels are what people see. */
export const MAHR_TYPE_OPTIONS = [
  { value: 'gold_or_ornaments', label: 'Gold or Ornaments' },
  { value: 'cash', label: 'Cash' },
  { value: 'land', label: 'Land' },
  { value: 'other', label: 'Other' },
] as const;

export type MahrType = (typeof MAHR_TYPE_OPTIONS)[number]['value'];

export const mahrTypeLabel = (type?: string | null): string =>
  MAHR_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? '';

/** "Gold or Ornaments", or for Other the described type ("Other: Car"). Empty when none was recorded. */
export const mahrTypeDisplay = (type?: string | null, other?: string | null): string => {
  if (!type) return '';
  if (type === 'other') return other ? `Other: ${other}` : 'Other';
  return mahrTypeLabel(type) || type;
};

/** Local or international: digits with an optional leading +, and spaces, dashes, dots or brackets between. */
export const WITNESS_PHONE_PATTERN = /^\+?\(?[0-9][0-9\s\-().]{4,18}[0-9]$/;

const text = (label: string, max: number) =>
  z.string().max(max, `Please keep the ${label} to ${max} characters or less.`).optional();

const phone = (label: string) =>
  z
    .string()
    .max(20, `Please keep the ${label} to 20 characters or less.`)
    .refine((value) => value.trim() === '' || WITNESS_PHONE_PATTERN.test(value.trim()), {
      message: `Please enter a valid ${label} (digits, with an optional + and country code).`,
    })
    .optional();

/** The Nikah fields added after the first release; merged into the create and edit form schemas. */
export const nikahDetailShape = {
  groomAddress: text('groom address', 500),
  brideAddress: text('bride address', 500),
  witness1Phone: phone('phone number for witness 1'),
  witness1Address: text('address of witness 1', 500),
  witness2Phone: phone('phone number for witness 2'),
  witness2Address: text('address of witness 2', 500),
  mahrType: z.enum(['gold_or_ornaments', 'cash', 'land', 'other']).optional().or(z.literal('')),
  mahrTypeOther: text('mahr type', 100),
};

/** "Other" needs a description. */
export const requireMahrOther = (data: { mahrType?: string; mahrTypeOther?: string }, ctx: z.RefinementCtx) => {
  if (data.mahrType === 'other' && !data.mahrTypeOther?.trim()) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['mahrTypeOther'], message: 'Please specify the mahr type.' });
  }
};
