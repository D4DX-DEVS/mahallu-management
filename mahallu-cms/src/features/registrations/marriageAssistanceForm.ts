import { z } from 'zod';

/*
 * The Marriage Assistance create form: its rules and the request it sends. Kept free of React so the same
 * code is what the tests run.
 *
 * Only Financial Assistance pays money, so only it has an Amount. The API enforces the same rule
 * (POST /marriage-assistance: `amount` required for `financial_assistance`, more than 0 up to 100,000,000,
 * at most 2 decimals). The other types are sent without an `amount` property at all, never with a 0.
 */

export const MARRIAGE_ASSISTANCE_TYPES = ['proposal_support', 'financial_assistance', 'premarital_counselling'] as const;
export type MarriageAssistanceType = (typeof MARRIAGE_ASSISTANCE_TYPES)[number];

export const FINANCIAL_ASSISTANCE: MarriageAssistanceType = 'financial_assistance';

export const MARRIAGE_ASSISTANCE_TYPE_OPTIONS: { value: MarriageAssistanceType; label: string }[] = [
  { value: 'proposal_support', label: 'Proposal Support' },
  { value: 'financial_assistance', label: 'Financial Assistance' },
  { value: 'premarital_counselling', label: 'Premarital Counselling' },
];

/** Same ceiling as the API. */
export const MAX_ASSISTANCE_AMOUNT = 100_000_000;

export const requiresAmount = (type: string | undefined): boolean => type === FINANCIAL_ASSISTANCE;

export const AMOUNT_REQUIRED_MESSAGE = 'Please enter the amount.';
export const AMOUNT_INVALID_MESSAGE = 'Please enter a valid amount (a number with at most 2 decimal places).';
export const AMOUNT_ZERO_MESSAGE = 'The amount must be greater than zero.';
export const AMOUNT_NEGATIVE_MESSAGE = 'The amount cannot be negative.';
export const AMOUNT_TOO_LARGE_MESSAGE = `The amount cannot be more than ₹${MAX_ASSISTANCE_AMOUNT.toLocaleString('en-IN')}.`;

/** Plain decimal text, at most 2 decimals: `500`, `500.5`, `500.55`. No sign, no exponent. */
const MONEY_TEXT = /^\d+(\.\d{1,2})?$/;

/** What is wrong with the typed amount, or null when it is fine. A blank box is "required". */
export const amountError = (raw: unknown): string | null => {
  const text = raw === undefined || raw === null ? '' : String(raw).trim();
  if (text === '') return AMOUNT_REQUIRED_MESSAGE;
  if (/^-/.test(text) && Number.isFinite(Number(text))) return AMOUNT_NEGATIVE_MESSAGE;
  if (!MONEY_TEXT.test(text)) return AMOUNT_INVALID_MESSAGE;
  if (Number(text) <= 0) return AMOUNT_ZERO_MESSAGE;
  if (Number(text) > MAX_ASSISTANCE_AMOUNT) return AMOUNT_TOO_LARGE_MESSAGE;
  return null;
};

export const marriageAssistanceSchema = z
  .object({
    type: z.enum(MARRIAGE_ASSISTANCE_TYPES),
    personType: z.enum(['member', 'family']),
    memberId: z.string().max(200, 'Please keep the member to 200 characters or less.').optional(),
    familyId: z.string().max(200, 'Please keep the family to 200 characters or less.').optional(),
    // Typed text. It is only looked at for Financial Assistance; for the other types whatever is left in the
    // box is ignored.
    amount: z.string().optional(),
    notes: z.string().max(2000, 'Please keep the notes to 2000 characters or less.').optional(),
  })
  .superRefine((data, ctx) => {
    if (!(data.personType === 'member' ? data.memberId : data.familyId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: data.personType === 'member' ? 'Please select a member.' : 'Please select a family.',
        path: [data.personType === 'member' ? 'memberId' : 'familyId'],
      });
    }
    if (requiresAmount(data.type)) {
      const message = amountError(data.amount);
      if (message) ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: ['amount'] });
    }
  });

export type MarriageAssistanceFormData = z.infer<typeof marriageAssistanceSchema>;

export interface MarriageAssistancePayload {
  type: MarriageAssistanceType;
  memberId?: string;
  familyId?: string;
  amount?: number;
  notes?: string;
}

/** The body for POST /marriage-assistance. `amount` is present only for Financial Assistance. */
export const buildMarriageAssistancePayload = (data: MarriageAssistanceFormData): MarriageAssistancePayload => {
  const payload: MarriageAssistancePayload = {
    type: data.type,
    memberId: data.personType === 'member' ? data.memberId : undefined,
    familyId: data.personType === 'family' ? data.familyId : undefined,
    notes: data.notes,
  };
  if (requiresAmount(data.type)) payload.amount = Number(String(data.amount).trim());
  return payload;
};
