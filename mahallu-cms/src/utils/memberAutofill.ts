import type { Family, Member } from '@/types';

/**
 * What picking a member fills in on a form, as plain functions with no React in them.
 *
 * A form lists the fields a member can supply (a "fill": field name -> value) and `planAutofill`
 * decides what to write:
 *  - a field the new member has data for is set to it;
 *  - a field the new member has NO data for is cleared only if it still holds what the PREVIOUS
 *    member put there, so one member's details never linger after the selection moves on, and
 *    anything the person typed themselves is left alone;
 *  - nothing is invented: a missing value is never turned into a guess.
 *
 * Only data the member (or their family) really carries is used. A member record has no address; the
 * address of a person is their family's, so `familyAddressText` builds it from the family record.
 */

export type FillValue = string | number;
/** field name -> value; `undefined` or '' means "this member has nothing for that field". */
export type Fill = Record<string, FillValue | undefined>;

const clean = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const has = (value: FillValue | undefined): value is FillValue => value !== undefined && value !== '';

/** The member's family id, whether the list gave a plain id or a populated family object. */
export const familyIdOf = (member: { familyId?: unknown } | null | undefined): string => {
  const raw = member?.familyId;
  if (raw && typeof raw === 'object') {
    const ref = raw as { id?: unknown; _id?: unknown };
    return clean(ref.id) || clean(ref._id);
  }
  return clean(raw);
};

/** A phone as the forms store it: digits only, the last ten when the number carries a country code. */
export const phoneDigits = (phone: unknown): string => {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

/** `YYYY-MM-DD` for a date input, or '' when there is no usable date. */
export const dateInputValue = (value: unknown): string => {
  if (!value) return '';
  const date = new Date(value as string);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const joined = (parts: unknown[], separator = ', '): string => {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const part of parts) {
    const text = clean(part);
    const key = text.toLowerCase();
    if (text && !seen.has(key)) {
      seen.add(key);
      kept.push(text);
    }
  }
  return kept.join(separator);
};

/**
 * A multi-line postal address from a family record: house, locality, post office and pin code, district
 * and state. Empty parts are skipped; with no usable part the result is ''.
 */
export const familyAddressText = (family: Partial<Family> | null | undefined, maxLength = 500): string => {
  if (!family) return '';
  const lines = [
    joined([family.houseName, family.houseNo ? `House No. ${clean(family.houseNo)}` : '']),
    joined([family.area, family.place, family.via]),
    joined([family.postOffice, clean(family.pinCode) ? `PIN ${clean(family.pinCode)}` : ''], ' - '),
    joined([family.district, family.state]),
  ].filter(Boolean);
  return lines.join('\n').slice(0, maxLength);
};

/* ---------- per-form fills: which fields a member supplies ---------- */

/** Death registration: the deceased. The name and family come from the selected member. */
export const deceasedFill = (member: Member): Fill => ({
  deceasedName: clean(member.name),
  deceasedNameMl: clean(member.nameMl),
  familyId: familyIdOf(member),
  mahallId: clean(member.mahallId),
});

/** NOC applicant. */
export const applicantFill = (member: Member): Fill => ({
  applicantName: clean(member.name),
  applicantNameMl: clean(member.nameMl),
  applicantPhone: phoneDigits(member.phone),
});

/** Nikah registration: the groom or the bride, plus the member id and the family's address. */
export const nikahPartyFill = (side: 'groom' | 'bride', member: Member, family: Family | null): Fill => ({
  [`${side}Name`]: clean(member.name),
  [`${side}NameMl`]: clean(member.nameMl),
  [`${side}Age`]: typeof member.age === 'number' && member.age > 0 ? member.age : undefined,
  [`${side}Address`]: familyAddressText(family),
  mahallId: clean(member.mahallId),
});

/** Grave record: the deceased member, their family and (for a member already marked deceased) the date. */
export const graveFill = (member: Member): Fill => ({
  deceasedName: clean(member.name),
  familyId: familyIdOf(member),
  dateOfDeath: member.isDead ? dateInputValue(member.dateOfDeath) : '',
});

/** Inheritance case: the deceased. */
export const inheritanceFill = (member: Member): Fill => ({
  deceasedName: clean(member.name),
});

/** Khateeb: the person's name, Malayalam name and contact number. */
export const khateebFill = (member: Member): Fill => ({
  name: clean(member.name),
  nameMl: clean(member.nameMl),
  contactNo: phoneDigits(member.phone),
});

/* ---------- the planner ---------- */

export interface AutofillPlan {
  /** Writes to make, in order. */
  updates: Array<[field: string, value: FillValue]>;
  /** What this fill put on the form: the next call's `previous`. */
  remembered: Fill;
}

/**
 * @param previous what the last fill put on the form
 * @param next what the newly selected member (or nobody) supplies
 * @param read the form's current value of a field
 */
export const planAutofill = (previous: Fill, next: Fill, read: (field: string) => unknown): AutofillPlan => {
  const updates: AutofillPlan['updates'] = [];
  const remembered: Fill = {};
  const fields = new Set([...Object.keys(previous), ...Object.keys(next)]);
  for (const field of fields) {
    const incoming = next[field];
    if (has(incoming)) {
      updates.push([field, incoming]);
      remembered[field] = incoming;
      continue;
    }
    const before = previous[field];
    if (has(before) && String(read(field) ?? '') === String(before)) updates.push([field, '']);
  }
  return { updates, remembered };
};
